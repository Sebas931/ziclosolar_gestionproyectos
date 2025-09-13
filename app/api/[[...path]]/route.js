import { NextResponse } from 'next/server';
import { MongoClient, Db } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

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

// Check if time entry is blocked by export closure
async function checkExportClosure(projectId, costCenterId, engineerId, date) {
  try {
    // Find active closures that might affect this time entry
    const activeClosure = await db.collection('export_closures').findOne({
      status: 'ACTIVO',
      date_start: { $lte: date },
      date_end: { $gte: date }
    });

    if (!activeClosure) {
      return { isBlocked: false, closure: null };
    }

    // Check if the scope includes this specific combination
    const scopeQuery = {
      closure_id: activeClosure.id,
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
          closure: activeClosure,
          message: `Operación bloqueada por cierre activo del ${activeClosure.date_start} al ${activeClosure.date_end}` 
        };
      }
    }

    return { isBlocked: false, closure: null };
  } catch (error) {
    console.error('Error checking export closure:', error);
    return { isBlocked: false, closure: null };
  }
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
      
      // Check export closure
      const closureCheck = await checkExportClosure(
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
        closure_id: null,
        post_export_adjustment: false
      };
      
      await db.collection('time_entries').insertOne(timeEntry);
      await logAudit('CREATE', 'time_entry', timeEntry.id, timeEntry);
      
      return corsResponse(NextResponse.json({ success: true, data: timeEntry }));
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
      
      const closureCheck = await checkExportClosure(
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
        updated_at: new Date().toISOString()
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
      
      const closureCheck = await checkExportClosure(
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