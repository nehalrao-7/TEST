// All values in centimetres.
export const BODY_FIELDS = [
  { key: 'height', label: 'Height', def: 165, help: 'Stand straight, barefoot. Floor to top of head.' },
  { key: 'neck', label: 'Neck', def: 34, help: 'Around the base of the neck, where a collar sits.' },
  { key: 'shoulder', label: 'Shoulder width', def: 38, help: 'Across the back, from one shoulder bone tip to the other.' },
  { key: 'bust', label: 'Bust', def: 90, help: 'Around the fullest part of the bust, tape level across the back.' },
  { key: 'underbust', label: 'Under-bust', def: 76, help: 'Snug around the ribcage directly under the bust.' },
  { key: 'waist', label: 'Waist', def: 74, help: 'Around the natural waist (narrowest part, just above the navel).' },
  { key: 'hip', label: 'Hip', def: 98, help: 'Around the fullest part of the hips/seat.' },
  { key: 'thigh', label: 'Thigh', def: 56, help: 'Around the fullest part of one thigh, just under the crotch.' },
  { key: 'knee', label: 'Knee', def: 37, help: 'Around the knee, leg straight.' },
  { key: 'calf', label: 'Calf', def: 35, help: 'Around the fullest part of the calf.' },
  { key: 'ankle', label: 'Ankle', def: 22, help: 'Around the ankle bone.' },
  { key: 'upperArm', label: 'Upper arm (bicep)', def: 28, help: 'Around the fullest part of the upper arm, arm relaxed.' },
  { key: 'wrist', label: 'Wrist', def: 15.5, help: 'Around the wrist bone.' },
  { key: 'armLength', label: 'Arm length', def: 57, help: 'Shoulder bone tip, over a slightly bent elbow, to wrist bone.' },
  { key: 'backLength', label: 'Nape to waist', def: 40, help: 'Back of neck (prominent bone) straight down to natural waist.' },
  { key: 'waistToHip', label: 'Waist to hip', def: 20, help: 'Side of body, from waist line down to fullest hip line.' },
  { key: 'waistHeight', label: 'Waist to floor', def: 102, help: 'Side of body, from natural waist straight down to the floor. (Follows from your other measurements; shown for checking.)' },
  { key: 'inseam', label: 'Inseam (crotch to floor)', def: 76, help: 'Inside leg, from crotch straight down to the floor.' },
];

export const BODY_DEFAULTS = Object.fromEntries(BODY_FIELDS.map((f) => [f.key, f.def]));

