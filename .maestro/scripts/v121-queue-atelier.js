// v1.21 : empile UN appel d'outil workshop_set_draft (brouillon 1 semaine, 2 seances) pour l'Atelier IA (fake Anthropic 8211).
var program = {
  name: 'Programme UAT Atelier', goal: 'Prise de force', split_type: 'Full body',
  weeks: [{ label: 'Volume', sessions: [
    { name: 'Full body A', day_of_week: 1, focus: 'Force', exercises: [
      { name: 'Squat', sets: 3, reps: '5', rest_seconds: 120 },
      { name: 'Developpe couche', sets: 3, reps: '5', rest_seconds: 120 },
      { name: 'Rowing barre', sets: 3, reps: '8', rest_seconds: 90 } ] },
    { name: 'Full body B', day_of_week: 3, focus: 'Hypertrophie', exercises: [
      { name: 'Souleve de terre roumain', sets: 3, reps: '8-10', rest_seconds: 90 },
      { name: 'Developpe militaire', sets: 3, reps: '8-10', rest_seconds: 90 },
      { name: 'Tractions assistees', sets: 3, reps: '8', rest_seconds: 90 } ] } ] }],
};
// La 1re séance tombe AUJOURD'HUI (ISO 1=lundi..7=dimanche) pour pouvoir la démarrer depuis l'onglet Entraînement.
var jsDay = new Date().getDay();
program.weeks[0].sessions[0].day_of_week = jsDay === 0 ? 7 : jsDay;
program.weeks[0].sessions[1].day_of_week = (program.weeks[0].sessions[0].day_of_week % 7) + 1;
var r = http.post('http://127.0.0.1:8211/__script', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tool: 'workshop_set_draft', count: 1, input: { program: program } }) });
console.log('queue-atelier status=' + r.status);
