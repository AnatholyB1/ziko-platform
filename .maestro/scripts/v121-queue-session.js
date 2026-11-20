// v1.21 : empile UNE reponse texte du faux Anthropic (8211) pour /ai/session/generate (meme corps que `fake-script.sh session`).
var body = JSON.stringify({
  text: JSON.stringify({
    adaptation_note: 'Energie moyenne : charges moderees et volume reduit.',
    exercises: [
      { name: 'Squat goblet', sets: '3 x 10', note: 'Dos droit' },
      { name: 'Developpe couche halteres', sets: '3 x 8-10' },
      { name: 'Rowing unilateral', sets: '3 x 10' },
      { name: 'Gainage planche', sets: '3 x 40 s' },
    ],
  }),
  count: 1,
});
var r = http.post('http://127.0.0.1:8211/__script', { headers: { 'content-type': 'application/json' }, body: body });
console.log('queue-session status=' + r.status);
