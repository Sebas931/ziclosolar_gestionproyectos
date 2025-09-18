'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Clock, Users, Building2, FolderOpen, Calendar, Download, AlertTriangle, Plus, Edit2, Trash2, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function App() {
  // State management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [projects, setProjects] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [exportClosures, setExportClosures] = useState([]);
  const [kpis, setKpis] = useState({});
  const [chartData, setChartData] = useState([]);
  
  // Form states
  const [timeEntryForm, setTimeEntryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    project_id: '',
    cost_center_id: '',
    engineer_id: '',
    concept_id: '',
    hours: '',
    notes: ''
  });
  
  const [entityForms, setEntityForms] = useState({
    project: { code: '', name: '', cost_center_id: '' },
    costCenter: { code: '', name: '' },
    engineer: { document_number: '', title: '', user_id: '' },
    concept: { code: '', name: '' }
  });
  
  // Dialog states
  const [showTimeEntryDialog, setShowTimeEntryDialog] = useState(false);
  const [showEntityDialog, setShowEntityDialog] = useState(false);
  const [currentEntity, setCurrentEntity] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Export and reopen states
  const [exportFilters, setExportFilters] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    project_ids: [],
    cost_center_ids: [],
    engineer_ids: []
  });
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState(null);
  const [reopenType, setReopenType] = useState('total');
  
  // Time entries view states
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTimeEntries, setProjectTimeEntries] = useState([]);
  
  // Project filters
  const [projectFilters, setProjectFilters] = useState({
    code: '',
    name: '',
    cost_center_id: '',
    status: ''
  });

  // API calls
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`/api/${endpoint}`, options);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Error en la operación');
      }
      
      return result;
    } catch (error) {
      console.error(`API Error (${method} ${endpoint}):`, error);
      toast.error(error.message || 'Error en la operación');
      throw error;
    }
  };

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, costCentersRes, engineersRes, conceptsRes, timeEntriesRes, kpisRes, chartRes, closuresRes] = await Promise.all([
        apiCall('projects'),
        apiCall('cost-centers'),
        apiCall('engineers'),
        apiCall('concepts'),
        apiCall('time-entries'),
        apiCall('dashboard/kpis'),
        apiCall('dashboard/hours-by-project'),
        apiCall('export-closures-detailed')
      ]);
      
      setProjects(projectsRes.data);
      setCostCenters(costCentersRes.data);
      setEngineers(engineersRes.data);
      setConcepts(conceptsRes.data);
      setTimeEntries(timeEntriesRes.data);
      setKpis(kpisRes.data);
      setChartData(chartRes.data);
      setExportClosures(closuresRes.data);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle time entry submission
  const handleTimeEntrySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editingId) {
        await apiCall(`time-entries/${editingId}`, 'PUT', timeEntryForm);
        toast.success('Registro de tiempo actualizado exitosamente');
      } else {
        await apiCall('time-entries', 'POST', timeEntryForm);
        toast.success('Registro de tiempo creado exitosamente');
      }
      
      setShowTimeEntryDialog(false);
      setEditingId(null);
      setTimeEntryForm({
        date: new Date().toISOString().split('T')[0],
        project_id: '',
        cost_center_id: '',
        engineer_id: '',
        concept_id: '',
        hours: '',
        notes: ''
      });
      
      // Reload data
      await loadData();
      
      // If we're in project detail view, also reload project time entries
      if (selectedProject) {
        await loadProjectTimeEntries(selectedProject.id);
      }
      
    } catch (error) {
      // Error already handled in apiCall
    } finally {
      setLoading(false);
    }
  };

  // Handle entity submission (projects, cost centers, etc.)
  const handleEntitySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const endpoint = currentEntity === 'costCenter' ? 'cost-centers' : `${currentEntity}s`;
      await apiCall(endpoint, 'POST', entityForms[currentEntity]);
      
      toast.success(`${currentEntity === 'costCenter' ? 'Centro de costos' : currentEntity} creado exitosamente`);
      setShowEntityDialog(false);
      setEntityForms({
        ...entityForms,
        [currentEntity]: currentEntity === 'project' 
          ? { code: '', name: '', client: '', cost_center_id: '' }
          : currentEntity === 'costCenter'
          ? { code: '', name: '' }
          : currentEntity === 'engineer'
          ? { document_number: '', title: '', user_id: '' }
          : { code: '', name: '' }
      });
      
      await loadData();
    } catch (error) {
      // Error already handled in apiCall
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    setLoading(true);
    try {
      await apiCall(`time-entries/${id}`, 'DELETE');
      toast.success('Registro eliminado exitosamente');
      setDeleteConfirm(null);
      
      // Reload data
      await loadData();
      
      // If we're in project detail view, also reload project time entries
      if (selectedProject) {
        await loadProjectTimeEntries(selectedProject.id);
      }
      
    } catch (error) {
      // Error already handled in apiCall
    } finally {
      setLoading(false);
    }
  };

  // Filter projects based on current filters
  const filteredProjects = projects.filter(project => {
    return (
      project.code.toLowerCase().includes(projectFilters.code.toLowerCase()) &&
      project.name.toLowerCase().includes(projectFilters.name.toLowerCase()) &&
      (projectFilters.cost_center_id === '' || project.cost_center_id === projectFilters.cost_center_id) &&
      (projectFilters.status === '' || project.status === projectFilters.status)
    );
  });

  // Clear project filters
  const clearProjectFilters = () => {
    setProjectFilters({
      code: '',
      name: '',
      cost_center_id: '',
      status: ''
    });
  };

  // Load project time entries
  const loadProjectTimeEntries = async (projectId) => {
    setLoading(true);
    try {
      const response = await apiCall(`time-entries?project_id=${projectId}`);
      setProjectTimeEntries(response.data);
    } catch (error) {
      console.error('Error loading project time entries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle project selection
  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    loadProjectTimeEntries(project.id);
  };

  // Go back to project list
  const handleBackToProjects = () => {
    setSelectedProject(null);
    setProjectTimeEntries([]);
  };

  // Edit time entry
  const editTimeEntry = (entry) => {
    setTimeEntryForm(entry);
    setEditingId(entry.id);
    setShowTimeEntryDialog(true);
  };

  // Handle Excel export
  const handleExcelExport = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportFilters)
      });
      
      if (response.ok) {
        // Get closure info from headers
        const closureId = response.headers.get('X-Closure-Id');
        const recordCount = response.headers.get('X-Record-Count');
        
        // Download file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `registros_tiempo_${exportFilters.start_date}_${exportFilters.end_date}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast.success(`Exportación completada. ${recordCount} registros exportados. Cierre ${closureId} creado.`);
        setShowExportDialog(false);
        await loadData(); // Reload to show updated closures
      } else {
        const error = await response.json();
        toast.error(error.message || 'Error en la exportación');
      }
    } catch (error) {
      toast.error('Error en la exportación: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle closure reopen
  const handleReopenClosure = async () => {
    setLoading(true);
    try {
      const body = {
        type: reopenType,
        user_id: 'admin', // TODO: Replace with actual user ID
        ...(reopenType === 'partial' && {
          partial_filters: {
            start_date: exportFilters.start_date,
            end_date: exportFilters.end_date,
            project_ids: exportFilters.project_ids.length ? exportFilters.project_ids : null,
            cost_center_ids: exportFilters.cost_center_ids.length ? exportFilters.cost_center_ids : null,
            engineer_ids: exportFilters.engineer_ids.length ? exportFilters.engineer_ids : null,
            note: 'Reapertura parcial desde UI'
          }
        })
      };
      
      const response = await fetch(`/api/export-closures/${selectedClosure.id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Cierre reabierto exitosamente. Estado: ${result.data.status}`);
        setShowReopenDialog(false);
        setSelectedClosure(null);
        await loadData();
      } else {
        toast.error(result.message || 'Error al reabrir cierre');
      }
    } catch (error) {
      toast.error('Error al reabrir cierre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-card-foreground">Ziklo Time Tracking</h1>
                <p className="text-sm text-muted-foreground">Gestión de tiempos y proyectos con cierre por exportación</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              Zona: America/Bogota
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="time-entries" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Registros de Tiempo
            </TabsTrigger>
            <TabsTrigger value="master-data" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Datos Maestros
            </TabsTrigger>
            <TabsTrigger value="exports" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exportaciones
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Proyectos</CardTitle>
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.total_projects || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis.active_projects || 0} activos
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ingenieros</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.total_engineers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Total registrados
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Horas Este Mes</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(kpis.monthly_hours || 0).toFixed(1)}h</div>
                  <p className="text-xs text-muted-foreground">
                    Registradas
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Centros de Costo</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{costCenters.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Configurados
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Horas por Proyecto</CardTitle>
                  <CardDescription>Distribución de horas registradas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="project_name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total_hours" fill="#0088FE" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Proyecto</CardTitle>
                  <CardDescription>Porcentaje de horas por proyecto</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({project_name, percent}) => `${project_name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="total_hours"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Time Entries Tab */}
          <TabsContent value="time-entries" className="space-y-6">
            {!selectedProject ? (
              // Project List View
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Registros de Tiempo - Seleccionar Proyecto</h2>
                </div>
                
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>Proyectos Disponibles</CardTitle>
                        <CardDescription>
                          Selecciona un proyecto para ver y gestionar sus registros de tiempo
                        </CardDescription>
                      </div>
                      
                      {/* Project Filters */}
                      <div className="flex flex-col gap-3 min-w-80">
                        <h4 className="font-medium text-sm">Filtros</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="filter_code" className="text-xs">Código</Label>
                            <Input
                              id="filter_code"
                              placeholder="Filtrar por código"
                              value={projectFilters.code}
                              onChange={(e) => setProjectFilters({...projectFilters, code: e.target.value})}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor="filter_name" className="text-xs">Nombre</Label>
                            <Input
                              id="filter_name"
                              placeholder="Filtrar por nombre"
                              value={projectFilters.name}
                              onChange={(e) => setProjectFilters({...projectFilters, name: e.target.value})}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor="filter_cost_center" className="text-xs">Centro de Costo</Label>
                            <Select value={projectFilters.cost_center_id} onValueChange={(value) => setProjectFilters({...projectFilters, cost_center_id: value === "all" ? "" : value})}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Todos" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todos los centros</SelectItem>
                                {costCenters.map((cc) => (
                                  <SelectItem key={cc.id} value={cc.id}>
                                    {cc.name} ({cc.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="filter_status" className="text-xs">Estado</Label>
                            <Select value={projectFilters.status} onValueChange={(value) => setProjectFilters({...projectFilters, status: value === "all" ? "" : value})}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Todos" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todos los estados</SelectItem>
                                <SelectItem value="active">Activo</SelectItem>
                                <SelectItem value="inactive">Inactivo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end col-span-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={clearProjectFilters}
                              className="h-8 text-xs"
                            >
                              Limpiar Filtros
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Mostrando {filteredProjects.length} de {projects.length} proyectos
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b bg-muted/50">
                          <tr>
                            <th className="text-left p-4">Código</th>
                            <th className="text-left p-4">Nombre</th>
                            <th className="text-left p-4">Centro de Costo</th>
                            <th className="text-left p-4">Estado</th>
                            <th className="text-left p-4">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProjects.map((project) => (
                            <tr 
                              key={project.id} 
                              className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => handleProjectSelect(project)}
                            >
                              <td className="p-4">
                                <span className="font-mono text-sm">{project.code}</span>
                              </td>
                              <td className="p-4">
                                <span className="font-medium">{project.name}</span>
                              </td>
                              <td className="p-4">
                                <span className="text-sm">
                                  {costCenters.find(cc => cc.id === project.cost_center_id)?.name || 'N/A'}
                                </span>
                              </td>
                              <td className="p-4">
                                <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                                  {project.status}
                                </Badge>
                              </td>
                              <td className="p-4">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent row click
                                    handleProjectSelect(project);
                                  }}
                                >
                                  Ver Registros
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      {filteredProjects.length === 0 && projects.length > 0 && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-2">No se encontraron proyectos con los filtros aplicados</p>
                          <Button variant="outline" size="sm" onClick={clearProjectFilters}>
                            Limpiar Filtros
                          </Button>
                        </div>
                      )}
                      
                      {projects.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">No hay proyectos disponibles</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              // Project Detail View
              <>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={handleBackToProjects}>
                      ← Volver a Proyectos
                    </Button>
                    <div>
                      <h2 className="text-2xl font-bold">{selectedProject.name}</h2>
                      <p className="text-muted-foreground">Código: {selectedProject.code} | Cliente: {selectedProject.client}</p>
                    </div>
                  </div>
                  <Button onClick={() => {
                    // Pre-fill project in form
                    setTimeEntryForm({
                      ...timeEntryForm,
                      project_id: selectedProject.id,
                      cost_center_id: selectedProject.cost_center_id
                    });
                    setShowTimeEntryDialog(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Registro
                  </Button>
                </div>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Registros de Tiempo</CardTitle>
                    <CardDescription>
                      {projectTimeEntries.length} registro(s) encontrado(s) para este proyecto
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b bg-muted/50">
                          <tr>
                            <th className="text-left p-4">Fecha</th>
                            <th className="text-left p-4">Ingeniero</th>
                            <th className="text-left p-4">Horas</th>
                            <th className="text-left p-4">Concepto</th>
                            <th className="text-left p-4">Notas</th>
                            <th className="text-left p-4">Post-Export</th>
                            <th className="text-left p-4">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectTimeEntries.map((entry) => (
                            <tr key={entry.id} className="border-b hover:bg-muted/50">
                              <td className="p-4">{entry.date}</td>
                              <td className="p-4">
                                {engineers.find(e => e.id === entry.engineer_id)?.title || 'N/A'}
                              </td>
                              <td className="p-4">
                                <Badge variant="secondary">{entry.hours}h</Badge>
                              </td>
                              <td className="p-4">
                                {concepts.find(c => c.id === entry.concept_id)?.name || 'N/A'}
                              </td>
                              <td className="p-4">
                                <span className="text-sm">{entry.notes || '-'}</span>
                              </td>
                              <td className="p-4">
                                {entry.post_export_adjustment ? (
                                  <Badge variant="outline" className="text-orange-600">
                                    Ajuste Post-Export
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Normal</Badge>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => editTimeEntry(entry)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setDeleteConfirm(entry.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      {projectTimeEntries.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4">No hay registros de tiempo para este proyecto</p>
                          <Button onClick={() => {
                            setTimeEntryForm({
                              ...timeEntryForm,
                              project_id: selectedProject.id,
                              cost_center_id: selectedProject.cost_center_id
                            });
                            setShowTimeEntryDialog(true);
                          }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Crear Primer Registro
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Master Data Tab */}
          <TabsContent value="master-data" className="space-y-6">
            <h2 className="text-2xl font-bold">Datos Maestros</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Projects */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Proyectos</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setCurrentEntity('project');
                        setShowEntityDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {projects.map((project) => (
                      <div key={project.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-sm text-muted-foreground">{project.code}</p>
                        </div>
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                          {project.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Cost Centers */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Centros de Costo</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setCurrentEntity('costCenter');
                        setShowEntityDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {costCenters.map((cc) => (
                      <div key={cc.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <p className="font-medium">{cc.name}</p>
                          <p className="text-sm text-muted-foreground">{cc.code}</p>
                        </div>
                        <Badge variant={cc.status === 'active' ? 'default' : 'secondary'}>
                          {cc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Engineers */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Ingenieros</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setCurrentEntity('engineer');
                        setShowEntityDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {engineers.map((engineer) => (
                      <div key={engineer.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <p className="font-medium">{engineer.title}</p>
                          <p className="text-sm text-muted-foreground">CC: {engineer.document_number}</p>
                        </div>
                        <Badge variant={engineer.status === 'active' ? 'default' : 'secondary'}>
                          {engineer.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Concepts */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Conceptos</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setCurrentEntity('concept');
                        setShowEntityDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {concepts.map((concept) => (
                      <div key={concept.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <p className="font-medium">{concept.name}</p>
                          <p className="text-sm text-muted-foreground">{concept.code}</p>
                        </div>
                        <Badge variant={concept.status === 'active' ? 'default' : 'secondary'}>
                          {concept.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Exports Tab */}
          <TabsContent value="exports" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestión de Exportaciones</h2>
              <Button onClick={() => setShowExportDialog(true)}>
                <Download className="h-4 w-4 mr-2" />
                Nueva Exportación
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Sistema de Cierre por Exportación
                </CardTitle>
                <CardDescription>
                  Cada exportación a Excel crea un cierre ACTIVO que bloquea modificaciones en el rango y alcance exportado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-green-600">ACTIVO</h4>
                    <p className="text-sm text-muted-foreground">Cierre aplicado, operaciones bloqueadas</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-blue-600">REABIERTO</h4>
                    <p className="text-sm text-muted-foreground">Cierre reabierto para ajustes</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-orange-600">PARCIALMENTE_REABIERTO</h4>
                    <p className="text-sm text-muted-foreground">Reapertura parcial con excepciones</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-gray-600">CERRADO_DEFINITIVO</h4>
                    <p className="text-sm text-muted-foreground">Cierre final, sin modificaciones</p>
                  </div>
                </div>

                {/* Export Closures Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-4">Fecha Inicio</th>
                        <th className="text-left p-4">Fecha Fin</th>
                        <th className="text-left p-4">Estado</th>
                        <th className="text-left p-4">Revisión</th>
                        <th className="text-left p-4">Creado Por</th>
                        <th className="text-left p-4">Fecha Creación</th>
                        <th className="text-left p-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportClosures.map((closure) => (
                        <tr key={closure.id} className="border-b hover:bg-muted/50">
                          <td className="p-4">{closure.date_start}</td>
                          <td className="p-4">{closure.date_end}</td>
                          <td className="p-4">
                            <Badge variant={
                              closure.status === 'ACTIVO' ? 'default' :
                              closure.status === 'REABIERTO' ? 'secondary' :
                              closure.status === 'PARCIALMENTE_REABIERTO' ? 'outline' :
                              'destructive'
                            }>
                              {closure.status}
                            </Badge>
                          </td>
                          <td className="p-4">v{closure.revision}</td>
                          <td className="p-4">{closure.created_by}</td>
                          <td className="p-4">{new Date(closure.created_at).toLocaleDateString()}</td>
                          <td className="p-4">
                            {closure.status === 'ACTIVO' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedClosure(closure);
                                  setShowReopenDialog(true);
                                }}
                              >
                                Reabrir
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Time Entry Dialog */}
      <Dialog open={showTimeEntryDialog} onOpenChange={setShowTimeEntryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar' : 'Nuevo'} Registro de Tiempo
            </DialogTitle>
            <DialogDescription>
              Registra las horas trabajadas en un proyecto específico.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTimeEntrySubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={timeEntryForm.date}
                  onChange={(e) => setTimeEntryForm({...timeEntryForm, date: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="hours">Horas</Label>
                <Input
                  id="hours"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="8"
                  value={timeEntryForm.hours}
                  onChange={(e) => setTimeEntryForm({...timeEntryForm, hours: e.target.value})}
                  placeholder="0.0"
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="project">Proyecto</Label>
              <Select value={timeEntryForm.project_id} onValueChange={(value) => setTimeEntryForm({...timeEntryForm, project_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} ({project.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost_center">Centro de Costo</Label>
                <Select value={timeEntryForm.cost_center_id} onValueChange={(value) => setTimeEntryForm({...timeEntryForm, cost_center_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.name} ({cc.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="engineer">Ingeniero</Label>
                <Select value={timeEntryForm.engineer_id} onValueChange={(value) => setTimeEntryForm({...timeEntryForm, engineer_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {engineers.map((engineer) => (
                      <SelectItem key={engineer.id} value={engineer.id}>
                        {engineer.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="concept">Concepto</Label>
              <Select value={timeEntryForm.concept_id} onValueChange={(value) => setTimeEntryForm({...timeEntryForm, concept_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar concepto" />
                </SelectTrigger>
                <SelectContent>
                  {concepts.map((concept) => (
                    <SelectItem key={concept.id} value={concept.id}>
                      {concept.name} ({concept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={timeEntryForm.notes}
                onChange={(e) => setTimeEntryForm({...timeEntryForm, notes: e.target.value})}
                placeholder="Descripción del trabajo realizado..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowTimeEntryDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Entity Dialog */}
      <Dialog open={showEntityDialog} onOpenChange={setShowEntityDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Nuevo {currentEntity === 'costCenter' ? 'Centro de Costos' : 
                     currentEntity === 'engineer' ? 'Ingeniero' : 
                     currentEntity === 'concept' ? 'Concepto' : 'Proyecto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEntitySubmit} className="space-y-4">
            {currentEntity === 'project' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Código</Label>
                    <Input
                      id="code"
                      value={entityForms.project.code}
                      onChange={(e) => setEntityForms({
                        ...entityForms,
                        project: {...entityForms.project, code: e.target.value}
                      })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={entityForms.project.name}
                      onChange={(e) => setEntityForms({
                        ...entityForms,
                        project: {...entityForms.project, name: e.target.value}
                      })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="client">Cliente</Label>
                  <Input
                    id="client"
                    value={entityForms.project.client}
                    onChange={(e) => setEntityForms({
                      ...entityForms,
                      project: {...entityForms.project, client: e.target.value}
                    })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cost_center_id">Centro de Costo</Label>
                  <Select value={entityForms.project.cost_center_id} onValueChange={(value) => setEntityForms({
                    ...entityForms,
                    project: {...entityForms.project, cost_center_id: value}
                  })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar centro de costo" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCenters.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.name} ({cc.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {currentEntity === 'costCenter' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    value={entityForms.costCenter.code}
                    onChange={(e) => setEntityForms({
                      ...entityForms,
                      costCenter: {...entityForms.costCenter, code: e.target.value}
                    })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={entityForms.costCenter.name}
                    onChange={(e) => setEntityForms({
                      ...entityForms,
                      costCenter: {...entityForms.costCenter, name: e.target.value}
                    })}
                    required
                  />
                </div>
              </div>
            )}

            {currentEntity === 'engineer' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="document_number">Número de Documento</Label>
                  <Input
                    id="document_number"
                    value={entityForms.engineer.document_number}
                    onChange={(e) => setEntityForms({
                      ...entityForms,
                      engineer: {...entityForms.engineer, document_number: e.target.value}
                    })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="title">Nombre/Título</Label>
                  <Input
                    id="title"
                    value={entityForms.engineer.title}
                    onChange={(e) => setEntityForms({
                      ...entityForms,
                      engineer: {...entityForms.engineer, title: e.target.value}
                    })}
                    required
                  />
                </div>
              </div>
            )}

            {currentEntity === 'concept' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    value={entityForms.concept.code}
                    onChange={(e) => setEntityForms({
                      ...entityForms,
                      concept: {...entityForms.concept, code: e.target.value}
                    })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={entityForms.concept.name}
                    onChange={(e) => setEntityForms({
                      ...entityForms,
                      concept: {...entityForms.concept, name: e.target.value}
                    })}
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEntityDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creando...' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirma la eliminación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El registro de tiempo será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deleteConfirm)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Registros a Excel</DialogTitle>
            <DialogDescription>
              Selecciona los filtros para la exportación. Se creará un cierre ACTIVO para el rango/alcance exportado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="export_start_date">Fecha Inicio</Label>
                <Input
                  id="export_start_date"
                  type="date"
                  value={exportFilters.start_date}
                  onChange={(e) => setExportFilters({...exportFilters, start_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="export_end_date">Fecha Fin</Label>
                <Input
                  id="export_end_date"
                  type="date"
                  value={exportFilters.end_date}
                  onChange={(e) => setExportFilters({...exportFilters, end_date: e.target.value})}
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="export_projects">Proyectos (opcional)</Label>
              <Select onValueChange={(value) => setExportFilters({
                ...exportFilters, 
                project_ids: value && value !== "all" ? [value] : []
              })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los proyectos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proyectos</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} ({project.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowExportDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleExcelExport} disabled={loading}>
                {loading ? 'Exportando...' : 'Exportar Excel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir Cierre</DialogTitle>
            <DialogDescription>
              ⚠️ Solo administradores pueden reabrir cierres. Los cambios durante la reapertura se marcarán como ajustes post-exportación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Reapertura</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value="total"
                    checked={reopenType === 'total'}
                    onChange={(e) => setReopenType(e.target.value)}
                  />
                  <span>Total</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value="partial"
                    checked={reopenType === 'partial'}
                    onChange={(e) => setReopenType(e.target.value)}
                  />
                  <span>Parcial</span>
                </label>
              </div>
            </div>

            {reopenType === 'partial' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="reopen_start_date">Fecha Inicio</Label>
                    <Input
                      id="reopen_start_date"
                      type="date"
                      value={exportFilters.start_date}
                      onChange={(e) => setExportFilters({...exportFilters, start_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reopen_end_date">Fecha Fin</Label>
                    <Input
                      id="reopen_end_date"
                      type="date"
                      value={exportFilters.end_date}
                      onChange={(e) => setExportFilters({...exportFilters, end_date: e.target.value})}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowReopenDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleReopenClosure} disabled={loading} variant="destructive">
                {loading ? 'Reabriendo...' : 'Reabrir Cierre'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}