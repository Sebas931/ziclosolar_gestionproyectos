import { NextResponse } from 'next/server';
import { MongoClient, Db } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

let client;
let db;

// Initialize MongoDB connection
async function connectToDatabase() {
  if (!client) {
    try {
      client = new MongoClient(process.env.MONGO_URL);
      await client.connect();
      db = client.db(process.env.DB_NAME || 'ziklo_time_tracking');
      console.log('Connected to MongoDB successfully');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }
  return { client, db };
}

// Utility function to handle CORS
function corsResponse(response = null) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  
  if (response) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
  
  return new NextResponse(null, { status: 200, headers });
}

// Audit logging function
async function logAudit(action, entity, entityId, payload, userId = 'system', ip = 'unknown') {
  try {
    const auditEntry = {
      id: uuidv4(),
      actor_user_id: userId,
      action,
      entity,
      entity_id: entityId,
      payload,
      ip,
      user_agent: 'API',
      created_at: new Date().toISOString()
    };
    
    await db.collection('audit_log').insertOne(auditEntry);
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

// Date validation for America/Bogota timezone
function validateDate(dateString) {
  try {
    const date = new Date(dateString);
    const bogotaDate = new Date(date.toLocaleString("en-US", {timeZone: "America/Bogota"}));
    return {
      isValid: !isNaN(date.getTime()),
      date: bogotaDate,
      isoString: bogotaDate.toISOString().split('T')[0]
    };
  } catch (error) {
    return { isValid: false, date: null, isoString: null };
  }
}

// Excel export with closure creation
async function createExcelExport(filters, userId = 'system') {
  try {
    const { start_date, end_date, project_ids, cost_center_ids, engineer_ids } = filters;
    
    // Build query for time entries
    let query = {};
    if (start_date && end_date) {
      query.date = { $gte: start_date, $lte: end_date };
    }
    if (project_ids?.length) {
      query.project_id = { $in: project_ids };
    }
    if (cost_center_ids?.length) {
      query.cost_center_id = { $in: cost_center_ids };
    }
    if (engineer_ids?.length) {
      query.engineer_id = { $in: engineer_ids };
    }
    
    // Get time entries with lookups
    const timeEntries = await db.collection('time_entries').aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'projects',
          localField: 'project_id',
          foreignField: 'id',
          as: 'project'
        }
      },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'engineers',
          localField: 'engineer_id',
          foreignField: 'id',
          as: 'engineer'
        }
      },
      { $unwind: { path: '$engineer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'cost_centers',
          localField: 'cost_center_id',
          foreignField: 'id',
          as: 'cost_center'
        }
      },
      { $unwind: { path: '$cost_center', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'concepts',
          localField: 'concept_id',
          foreignField: 'id',
          as: 'concept'
        }
      },
      { $unwind: { path: '$concept', preserveNullAndEmptyArrays: true } },
      { $sort: { date: 1, 'project.name': 1 } }
    ]).toArray();
    
    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare data for Excel
    const excelData = timeEntries.map(entry => ({
      'Fecha': entry.date,
      'Proyecto': entry.project?.name || 'N/A',
      'Código Proyecto': entry.project?.code || 'N/A',
      'Centro de Costo': entry.cost_center?.name || 'N/A',
      'Código CC': entry.cost_center?.code || 'N/A',
      'Ingeniero': entry.engineer?.title || 'N/A',
      'Documento': entry.engineer?.document_number || 'N/A',
      'Concepto': entry.concept?.name || 'N/A',
      'Código Concepto': entry.concept?.code || 'N/A',
      'Horas': entry.hours,
      'Notas': entry.notes || '',
      'Creado Por': entry.created_by,
      'Fecha Creación': entry.created_at,
      'Post-Export Adj': entry.post_export_adjustment ? 'SÍ' : 'NO'
    }));
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros de Tiempo');
    
    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Generate hash for idempotency
    const exportHash = Buffer.from(JSON.stringify({
      start_date,
      end_date,
      project_ids: project_ids?.sort(),
      cost_center_ids: cost_center_ids?.sort(),
      engineer_ids: engineer_ids?.sort(),
      count: timeEntries.length
    })).toString('base64');
    
    // Check for existing identical closure (idempotency)
    const existingClosure = await db.collection('export_closures').findOne({
      status: 'ACTIVO',
      date_start: start_date,
      date_end: end_date,
      export_hash: exportHash
    });
    
    let closure;
    if (existingClosure) {
      // Update existing closure (increment revision)
      closure = await db.collection('export_closures').findOneAndUpdate(
        { id: existingClosure.id },
        { 
          $set: { 
            revision: existingClosure.revision + 1,
            export_file_id: uuidv4(),
            created_at: new Date().toISOString()
          }
        },
        { returnDocument: 'after' }
      );
      await logAudit('UPDATE', 'export_closure', existingClosure.id, { revision: closure.revision }, userId);
    } else {
      // Create new closure
      const closureId = uuidv4();
      closure = {
        id: closureId,
        status: 'ACTIVO',
        date_start: start_date,
        date_end: end_date,
        created_by: userId,
        created_at: new Date().toISOString(),
        export_file_id: uuidv4(),
        export_hash: exportHash,
        revision: 1
      };
      
      await db.collection('export_closures').insertOne(closure);
      
      // Create closure scope entries
      const scopeEntries = [];
      
      // If no specific filters, means "all" (null values)
      if (!project_ids?.length && !cost_center_ids?.length && !engineer_ids?.length) {
        scopeEntries.push({
          id: uuidv4(),
          closure_id: closureId,
          project_id: null,
          cost_center_id: null,
          engineer_id: null
        });
      } else {
        // Create specific scope entries
        const projects = project_ids?.length ? project_ids : [null];
        const costCenters = cost_center_ids?.length ? cost_center_ids : [null];
        const engineers = engineer_ids?.length ? engineer_ids : [null];
        
        for (const projectId of projects) {
          for (const costCenterId of costCenters) {
            for (const engineerId of engineers) {
              scopeEntries.push({
                id: uuidv4(),
                closure_id: closureId,
                project_id: projectId,
                cost_center_id: costCenterId,
                engineer_id: engineerId
              });
            }
          }
        }
      }
      
      if (scopeEntries.length > 0) {
        await db.collection('export_closure_scope').insertMany(scopeEntries);
      }
      
      await logAudit('CREATE', 'export_closure', closureId, closure, userId);
    }
    
    return {
      closure: closure,
      excelBuffer: excelBuffer,
      filename: `registros_tiempo_${start_date}_${end_date}.xlsx`,
      recordCount: timeEntries.length
    };
    
  } catch (error) {
    console.error('Error creating Excel export:', error);
    throw error;
  }
}

// Reopen closure (total or partial)
async function reopenClosure(closureId, reopenType = 'total', partialFilters = null, userId = 'system') {
  try {
    const closure = await db.collection('export_closures').findOne({ id: closureId });
    if (!closure) {
      throw new Error('Cierre no encontrado');
    }
    
    if (closure.status !== 'ACTIVO') {
      throw new Error('Solo se pueden reabrir cierres ACTIVOS');
    }
    
    let newStatus;
    if (reopenType === 'total') {
      newStatus = 'REABIERTO';
      
      // Update closure status
      await db.collection('export_closures').updateOne(
        { id: closureId },
        { 
          $set: { 
            status: newStatus,
            reopened_at: new Date().toISOString(),
            reopened_by: userId
          }
        }
      );
      
    } else if (reopenType === 'partial') {
      newStatus = 'PARCIALMENTE_REABIERTO';
      
      // Create partial reopen exception
      const exceptionId = uuidv4();
      const exception = {
        id: exceptionId,
        closure_id: closureId,
        date_start: partialFilters.start_date || closure.date_start,
        date_end: partialFilters.end_date || closure.date_end,
        projects_override: partialFilters.project_ids || null,
        cost_centers_override: partialFilters.cost_center_ids || null,
        engineers_override: partialFilters.engineer_ids || null,
        created_by: userId,
        created_at: new Date().toISOString(),
        note: partialFilters.note || 'Reapertura parcial'
      };
      
      await db.collection('export_closure_exceptions').insertOne(exception);
      
      // Update closure status
      await db.collection('export_closures').updateOne(
        { id: closureId },
        { 
          $set: { 
            status: newStatus,
            reopened_at: new Date().toISOString(),
            reopened_by: userId
          }
        }
      );
    }
    
    await logAudit('REOPEN', 'export_closure', closureId, { type: reopenType, filters: partialFilters }, userId);
    
    return { success: true, status: newStatus };
    
  } catch (error) {
    console.error('Error reopening closure:', error);
    throw error;
  }
}

// Enhanced closure check with partial reopen support
async function checkExportClosureEnhanced(projectId, costCenterId, engineerId, date) {
  try {
    // Find active or partially reopened closures
    const activeClosure = await db.collection('export_closures').findOne({
      status: { $in: ['ACTIVO', 'PARCIALMENTE_REABIERTO'] },
      date_start: { $lte: date },
      date_end: { $gte: date }
    });

    if (!activeClosure) {
      return { isBlocked: false, closure: null };
    }

    // If closure is fully active, check scope
    if (activeClosure.status === 'ACTIVO') {
      return await checkClosureScope(activeClosure, projectId, costCenterId, engineerId, date);
    }

    // If partially reopened, check exceptions
    if (activeClosure.status === 'PARCIALMENTE_REABIERTO') {
      const exceptions = await db.collection('export_closure_exceptions').find({
        closure_id: activeClosure.id,
        date_start: { $lte: date },
        date_end: { $gte: date }
      }).toArray();

      // Check if any exception allows this operation
      for (const exception of exceptions) {
        const isInException = (
          (!exception.projects_override || exception.projects_override.includes(projectId)) &&
          (!exception.cost_centers_override || exception.cost_centers_override.includes(costCenterId)) &&
          (!exception.engineers_override || exception.engineers_override.includes(engineerId))
        );
        
        if (isInException) {
          return { isBlocked: false, closure: activeClosure, inException: true };
        }
      }

      // If not in any exception, check original scope
      return await checkClosureScope(activeClosure, projectId, costCenterId, engineerId, date);
    }

    return { isBlocked: false, closure: null };
  } catch (error) {
    console.error('Error checking enhanced export closure:', error);
    return { isBlocked: false, closure: null };
  }
}

async function checkClosureScope(closure, projectId, costCenterId, engineerId, date) {
  const scopeQuery = {
    closure_id: closure.id,
    $or: [
      // All projects (project_id is null)
      { project_id: null },
      // Specific project matches
      { project_id: projectId }
    ]
  };

  const scope = await db.collection('export_closure_scope').findOne(scopeQuery);
  
  if (scope) {
    // Additional checks for cost_center and engineer scope
    const isInScope = (
      (scope.cost_center_id === null || scope.cost_center_id === costCenterId) &&
      (scope.engineer_id === null || scope.engineer_id === engineerId)
    );
    
    if (isInScope) {
      return { 
        isBlocked: true, 
        closure: closure,
        message: `Operación bloqueada por cierre ${closure.status.toLowerCase()} del ${closure.date_start} al ${closure.date_end}` 
      };
    }
  }

  return { isBlocked: false, closure: closure };
}

// Validate daily hours limit
async function validateDailyHours(engineerId, date, newHours, excludeEntryId = null) {
  try {
    const existingEntries = await db.collection('time_entries').find({
      engineer_id: engineerId,
      date: date,
      ...(excludeEntryId && { id: { $ne: excludeEntryId } })
    }).toArray();

    const totalExistingHours = existingEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
    const totalHours = totalExistingHours + parseFloat(newHours);
    const maxHours = parseFloat(process.env.MAX_HOURS_PER_DAY || '8');

    return {
      isValid: totalHours <= maxHours,
      totalHours,
      maxHours,
      message: totalHours > maxHours ? `Total de horas (${totalHours}) excede el límite diario de ${maxHours}h` : null
    };
  } catch (error) {
    console.error('Error validating daily hours:', error);
    return { isValid: false, message: 'Error validating daily hours' };
  }
}

export async function GET(request, { params }) {
  await connectToDatabase();
  
  const { pathname } = new URL(request.url);
  const pathSegments = pathname.split('/').filter(Boolean).slice(1); // Remove 'api' prefix
  
  try {
    // Routes
    if (pathSegments[0] === 'users') {
      const users = await db.collection('users').find({}).toArray();
      return corsResponse(NextResponse.json({ success: true, data: users }));
    }
    
    if (pathSegments[0] === 'projects') {
      const projects = await db.collection('projects').find({}).toArray();
      return corsResponse(NextResponse.json({ success: true, data: projects }));
    }
    
    if (pathSegments[0] === 'cost-centers') {
      const costCenters = await db.collection('cost_centers').find({}).toArray();
      return corsResponse(NextResponse.json({ success: true, data: costCenters }));
    }
    
    if (pathSegments[0] === 'engineers') {
      const engineers = await db.collection('engineers').find({}).toArray();
      return corsResponse(NextResponse.json({ success: true, data: engineers }));
    }
    
    if (pathSegments[0] === 'concepts') {
      const concepts = await db.collection('concepts').find({}).toArray();
      return corsResponse(NextResponse.json({ success: true, data: concepts }));
    }
    
    if (pathSegments[0] === 'time-entries') {
      const { searchParams } = new URL(request.url);
      const startDate = searchParams.get('start_date');
      const endDate = searchParams.get('end_date');
      const projectId = searchParams.get('project_id');
      const engineerId = searchParams.get('engineer_id');
      
      let query = {};
      if (startDate && endDate) {
        query.date = { $gte: startDate, $lte: endDate };
      }
      if (projectId) query.project_id = projectId;
      if (engineerId) query.engineer_id = engineerId;
      
      const timeEntries = await db.collection('time_entries').find(query).toArray();
      return corsResponse(NextResponse.json({ success: true, data: timeEntries }));
    }
    
    if (pathSegments[0] === 'export-closures') {
      const closures = await db.collection('export_closures').find({}).sort({ created_at: -1 }).toArray();
      return corsResponse(NextResponse.json({ success: true, data: closures }));
    }
    
    // Export closures with scope details
    if (pathSegments[0] === 'export-closures-detailed') {
      const closures = await db.collection('export_closures').aggregate([
        {
          $lookup: {
            from: 'export_closure_scope',
            localField: 'id',
            foreignField: 'closure_id',
            as: 'scope'
          }
        },
        {
          $lookup: {
            from: 'export_closure_exceptions',
            localField: 'id',
            foreignField: 'closure_id',
            as: 'exceptions'
          }
        },
        { $sort: { created_at: -1 } }
      ]).toArray();
      
      return corsResponse(NextResponse.json({ success: true, data: closures }));
    }
    
    if (pathSegments[0] === 'dashboard') {
      if (pathSegments[1] === 'kpis') {
        // Get basic KPIs
        const totalProjects = await db.collection('projects').countDocuments({});
        const activeProjects = await db.collection('projects').countDocuments({ status: 'active' });
        const totalEngineers = await db.collection('engineers').countDocuments({});
        
        // Get time entries for current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const monthlyHours = await db.collection('time_entries').aggregate([
          {
            $match: {
              date: { $gte: startOfMonth, $lte: endOfMonth }
            }
          },
          {
            $group: {
              _id: null,
              total_hours: { $sum: { $toDouble: "$hours" } }
            }
          }
        ]).toArray();
        
        const totalMonthlyHours = monthlyHours.length > 0 ? monthlyHours[0].total_hours : 0;
        
        return corsResponse(NextResponse.json({ 
          success: true, 
          data: {
            total_projects: totalProjects,
            active_projects: activeProjects,
            total_engineers: totalEngineers,
            monthly_hours: totalMonthlyHours
          }
        }));
      }
      
      if (pathSegments[1] === 'hours-by-project') {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        
        let matchQuery = {};
        if (startDate && endDate) {
          matchQuery.date = { $gte: startDate, $lte: endDate };
        }
        
        const hoursByProject = await db.collection('time_entries').aggregate([
          { $match: matchQuery },
          {
            $lookup: {
              from: 'projects',
              localField: 'project_id',
              foreignField: 'id',
              as: 'project'
            }
          },
          { $unwind: '$project' },
          {
            $group: {
              _id: '$project_id',
              project_name: { $first: '$project.name' },
              total_hours: { $sum: { $toDouble: '$hours' } }
            }
          },
          { $sort: { total_hours: -1 } }
        ]).toArray();
        
        return corsResponse(NextResponse.json({ success: true, data: hoursByProject }));
      }
    }
    
    return corsResponse(NextResponse.json({ success: false, message: 'Endpoint not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('GET Error:', error);
    return corsResponse(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
  }
}

export async function POST(request, { params }) {
  await connectToDatabase();
  
  const { pathname } = new URL(request.url);
  const pathSegments = pathname.split('/').filter(Boolean).slice(1);
  
  try {
    const body = await request.json();
    
    if (pathSegments[0] === 'users') {
      const user = {
        id: uuidv4(),
        external_id: body.external_id || uuidv4(),
        name: body.name,
        email: body.email,
        status: body.status || 'active',
        created_at: new Date().toISOString()
      };
      
      await db.collection('users').insertOne(user);
      await logAudit('CREATE', 'user', user.id, user);
      
      return corsResponse(NextResponse.json({ success: true, data: user }));
    }
    
    if (pathSegments[0] === 'projects') {
      const project = {
        id: uuidv4(),
        code: body.code,
        name: body.name,
        client: body.client,
        status: body.status || 'active',
        leader_user_id: body.leader_user_id,
        cost_center_id: body.cost_center_id,
        created_at: new Date().toISOString()
      };
      
      await db.collection('projects').insertOne(project);
      await logAudit('CREATE', 'project', project.id, project);
      
      return corsResponse(NextResponse.json({ success: true, data: project }));
    }
    
    if (pathSegments[0] === 'cost-centers') {
      const costCenter = {
        id: uuidv4(),
        code: body.code,
        name: body.name,
        status: body.status || 'active',
        created_at: new Date().toISOString()
      };
      
      await db.collection('cost_centers').insertOne(costCenter);
      await logAudit('CREATE', 'cost_center', costCenter.id, costCenter);
      
      return corsResponse(NextResponse.json({ success: true, data: costCenter }));
    }
    
    if (pathSegments[0] === 'engineers') {
      const engineer = {
        id: uuidv4(),
        user_id: body.user_id,
        document_number: body.document_number,
        title: body.title,
        status: body.status || 'active',
        created_at: new Date().toISOString()
      };
      
      await db.collection('engineers').insertOne(engineer);
      await logAudit('CREATE', 'engineer', engineer.id, engineer);
      
      return corsResponse(NextResponse.json({ success: true, data: engineer }));
    }
    
    if (pathSegments[0] === 'concepts') {
      const concept = {
        id: uuidv4(),
        code: body.code,
        name: body.name,
        status: body.status || 'active',
        created_at: new Date().toISOString()
      };
      
      await db.collection('concepts').insertOne(concept);
      await logAudit('CREATE', 'concept', concept.id, concept);
      
      return corsResponse(NextResponse.json({ success: true, data: concept }));
    }
    
    if (pathSegments[0] === 'time-entries') {
      const dateValidation = validateDate(body.date);
      if (!dateValidation.isValid) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: 'Fecha inválida' 
        }, { status: 400 }));
      }
      
      // Check export closure (enhanced version)
      const closureCheck = await checkExportClosureEnhanced(
        body.project_id, 
        body.cost_center_id, 
        body.engineer_id, 
        dateValidation.isoString
      );
      
      if (closureCheck.isBlocked) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: closureCheck.message 
        }, { status: 409 }));
      }
      
      // Validate daily hours
      const hoursValidation = await validateDailyHours(
        body.engineer_id, 
        dateValidation.isoString, 
        body.hours
      );
      
      if (!hoursValidation.isValid) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: hoursValidation.message 
        }, { status: 400 }));
      }
      
      const timeEntry = {
        id: uuidv4(),
        date: dateValidation.isoString,
        project_id: body.project_id,
        cost_center_id: body.cost_center_id,
        engineer_id: body.engineer_id,
        concept_id: body.concept_id,
        hours: parseFloat(body.hours),
        notes: body.notes || '',
        created_by: body.created_by || 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        closure_id: closureCheck.inException ? closureCheck.closure.id : null,
        post_export_adjustment: closureCheck.inException ? true : false
      };
      
      await db.collection('time_entries').insertOne(timeEntry);
      await logAudit('CREATE', 'time_entry', timeEntry.id, timeEntry);
      
      return corsResponse(NextResponse.json({ success: true, data: timeEntry }));
    }
    
    // Excel Export endpoint
    if (pathSegments[0] === 'export-excel') {
      try {
        const exportResult = await createExcelExport(body, body.user_id || 'system');
        
        // Return file as response
        const response = new NextResponse(exportResult.excelBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
            'X-Closure-Id': exportResult.closure.id,
            'X-Record-Count': exportResult.recordCount.toString()
          }
        });
        
        return corsResponse(response);
      } catch (error) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: `Error en exportación: ${error.message}` 
        }, { status: 500 }));
      }
    }
    
    // Reopen closure endpoints
    if (pathSegments[0] === 'export-closures' && pathSegments[2] === 'reopen') {
      const closureId = pathSegments[1];
      const reopenType = body.type || 'total';
      const partialFilters = body.partial_filters || null;
      const userId = body.user_id || 'system';
      
      try {
        const result = await reopenClosure(closureId, reopenType, partialFilters, userId);
        return corsResponse(NextResponse.json({ success: true, data: result }));
      } catch (error) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: error.message 
        }, { status: 400 }));
      }
    }
    
    return corsResponse(NextResponse.json({ success: false, message: 'Endpoint not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('POST Error:', error);
    return corsResponse(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
  }
}

export async function PUT(request, { params }) {
  await connectToDatabase();
  
  const { pathname } = new URL(request.url);
  const pathSegments = pathname.split('/').filter(Boolean).slice(1);
  
  try {
    const body = await request.json();
    const id = pathSegments[1];
    
    if (pathSegments[0] === 'time-entries') {
      // Check export closure before updating
      const dateValidation = validateDate(body.date);
      if (!dateValidation.isValid) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: 'Fecha inválida' 
        }, { status: 400 }));
      }
      
      const closureCheck = await checkExportClosureEnhanced(
        body.project_id, 
        body.cost_center_id, 
        body.engineer_id, 
        dateValidation.isoString
      );
      
      if (closureCheck.isBlocked) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: closureCheck.message 
        }, { status: 409 }));
      }
      
      // Validate daily hours (excluding current entry)
      const hoursValidation = await validateDailyHours(
        body.engineer_id, 
        dateValidation.isoString, 
        body.hours,
        id
      );
      
      if (!hoursValidation.isValid) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: hoursValidation.message 
        }, { status: 400 }));
      }
      
      const updateData = {
        date: dateValidation.isoString,
        project_id: body.project_id,
        cost_center_id: body.cost_center_id,
        engineer_id: body.engineer_id,
        concept_id: body.concept_id,
        hours: parseFloat(body.hours),
        notes: body.notes || '',
        updated_at: new Date().toISOString(),
        // Mark as post-export adjustment if in exception
        closure_id: closureCheck.inException ? closureCheck.closure.id : null,
        post_export_adjustment: closureCheck.inException ? true : false
      };
      
      const result = await db.collection('time_entries').findOneAndUpdate(
        { id: id },
        { $set: updateData },
        { returnDocument: 'after' }
      );
      
      if (!result) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: 'Registro de tiempo no encontrado' 
        }, { status: 404 }));
      }
      
      await logAudit('UPDATE', 'time_entry', id, updateData);
      
      return corsResponse(NextResponse.json({ success: true, data: result }));
    }
    
    return corsResponse(NextResponse.json({ success: false, message: 'Endpoint not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('PUT Error:', error);
    return corsResponse(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
  }
}

export async function DELETE(request, { params }) {
  await connectToDatabase();
  
  const { pathname } = new URL(request.url);
  const pathSegments = pathname.split('/').filter(Boolean).slice(1);
  
  try {
    const id = pathSegments[1];
    
    if (pathSegments[0] === 'time-entries') {
      // Get the entry first to check closure
      const entry = await db.collection('time_entries').findOne({ id: id });
      if (!entry) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: 'Registro de tiempo no encontrado' 
        }, { status: 404 }));
      }
      
      const closureCheck = await checkExportClosureEnhanced(
        entry.project_id, 
        entry.cost_center_id, 
        entry.engineer_id, 
        entry.date
      );
      
      if (closureCheck.isBlocked) {
        return corsResponse(NextResponse.json({ 
          success: false, 
          message: closureCheck.message 
        }, { status: 409 }));
      }
      
      await db.collection('time_entries').deleteOne({ id: id });
      await logAudit('DELETE', 'time_entry', id, entry);
      
      return corsResponse(NextResponse.json({ success: true, message: 'Registro eliminado' }));
    }
    
    return corsResponse(NextResponse.json({ success: false, message: 'Endpoint not found' }, { status: 404 }));
    
  } catch (error) {
    console.error('DELETE Error:', error);
    return corsResponse(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
  }
}

export async function OPTIONS(request) {
  return corsResponse();
}