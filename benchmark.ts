import { suggestReplacements } from './lib/clinical-logic';

const iterations = 10000;

console.time("baseline");
for (let i = 0; i < iterations; i++) {
  suggestReplacements({
    fromDrug: 'fluoxetine',
    currentDose: '20',
    duration: '6 months',
    reason: 'Weight Gain',
    secondaryEffect: 'none',
  });

  suggestReplacements({
    fromDrug: 'adalimumab',
    currentDose: '40',
    duration: '1 year',
    reason: 'Lack of efficacy',
    secondaryEffect: 'none',
    indication: 'Rheumatoid Arthritis'
  });
}
console.timeEnd("baseline");
