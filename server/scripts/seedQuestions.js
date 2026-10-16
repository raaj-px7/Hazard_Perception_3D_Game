require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('../models/Question');

// [question, [4 options], index of correct option, explanation]
const BANK = [
  ['You notice liquid spilled on a walkway. What is the right first step?', ['Step over it and carry on', 'Wait until the end of the shift', 'Warn others, block off the area and report it', 'Ignore it if it looks small'], 2, 'Spills are slip hazards. Warn people, mark the area and report it so it is cleaned up properly.'],
  ['How should heavy items be placed on pallet racking?', ['Heaviest on the lower levels, stacked evenly', 'Heaviest on top so they are easy to reach', 'Wherever there is space, as quickly as possible', 'Leaning against each other for support'], 0, 'Heavy loads low keep racking stable and reduce the risk of falling items.'],
  ['Where should a fire extinguisher be kept?', ['Behind stock to keep the aisle tidy', 'In a locked office', 'On the floor in a corner', 'Visible, unblocked and mounted at an accessible height'], 3, 'In an emergency people must be able to see and reach it in seconds.'],
  ['What is the safest way to lift a heavy box?', ['Bend at the waist and pull quickly', 'Bend your knees, keep your back straight and hold the load close', 'Twist your body while lifting', 'Lift with one hand to move faster'], 1, 'Using your legs and keeping the load close protects your back.'],
  ['A forklift is operating nearby. What should a pedestrian do?', ['Walk close behind it', 'Walk under the forks to save time', 'Keep clear of its path and make sure the driver has seen you', 'Assume it will always stop for you'], 2, 'Forklifts are heavy, have blind spots and cannot stop quickly.'],
  ['You find a power cable with exposed wires. What should you do?', ['Stop using it, tag it out and report it', 'Wrap it in tape and keep using it', 'Hide it under a mat', 'Use it only for light equipment'], 0, 'Damaged cables risk shock and fire and must be taken out of service.'],
  ['What is the rule for emergency exits?', ['Use them for storing spare stock', 'Keep them clear, unlocked and marked at all times', 'Block them temporarily when busy', 'Lock them to prevent theft'], 1, 'Exits and the routes to them must always be usable in an emergency.'],
  ['Which protective equipment suits an area where objects could fall from above?', ['A cap and sandals', 'Safety glasses only', 'Gloves only', 'A hard hat and safety footwear'], 3, 'Head and foot protection reduce injuries from falling objects.'],
  ['How should you use a ladder?', ['Keep three points of contact while climbing', 'Carry heavy loads in one hand', 'Stand on the top step to reach further', 'Lean it at a very steep angle'], 0, 'Three points of contact keep you stable while climbing.'],
  ['A pallet has broken boards. What should you do?', ['Use it for light items only', 'Remove it from use, tag it and report it', 'Flip it over and keep using it', 'Stack it at the back of the aisle'], 1, 'Damaged pallets can collapse under load and injure people.'],
  ['Why must aisles and walkways be kept clear?', ['To make the warehouse look tidy', 'It only matters during inspections', 'So people and vehicles can move safely and escape quickly', 'Clutter is fine if it is marked with tape'], 2, 'Clear routes prevent trips and collisions and allow a fast escape.'],
  ['A guard has been removed from a machine. What should you do?', ['Use the machine carefully', 'Do not operate it, isolate it and report it', 'Cover the gap with cardboard', 'Ask a colleague to watch you use it'], 1, 'Guards protect against moving parts. The machine stays out of service until it is fixed.'],
  ['At roughly what noise level is hearing protection normally required over an 8-hour shift?', ['50 dB', '70 dB', '85 dB', '120 dB only'], 2, 'Regular exposure at or above about 85 dB over a shift can damage hearing.'],
  ['Nobody was hurt in a near miss. What should you do?', ['Report it so the cause can be fixed', 'Say nothing because no one was hurt', 'Wait to see if it happens again', 'Mention it only to friends'], 0, 'Near misses are warnings. Reporting them helps prevent a real injury.'],
  ['How should hazardous chemical containers be stored?', ['Unlabelled to save space', 'Next to food in the break room', 'Labelled, closed and stored as the safety data sheet says', 'On the floor by the exit'], 2, 'Labels and correct storage prevent spills, reactions and mix-ups.'],
];

(async () => {
  if (!process.env.MONGODB_URI) { console.error('Set MONGODB_URI in .env first.'); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI);
  for (const [text, options, correctIndex, explanation] of BANK) {
    await Question.updateOne({ text }, { $set: { text, options, correctIndex, explanation, active: true } }, { upsert: true });
  }
  console.log(`Quiz bank ready: ${BANK.length} questions.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
