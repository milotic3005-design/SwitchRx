const fs = require('fs');
const path = require('path');

const doses = {
  'citalopram': [10, 20, 40],
  'escitalopram': [5, 10, 20],
  'fluoxetine': [10, 20, 40, 60],
  'sertraline': [25, 50, 100, 150, 200],
  'paroxetine': [10, 20, 30, 40],
  'fluvoxamine': [25, 50, 100],
  'venlafaxine': [37.5, 75, 150, 225],
  'duloxetine': [20, 30, 60],
  'desvenlafaxine': [25, 50, 100],
  'levomilnacipran': [20, 40, 80, 120],
  'milnacipran': [12.5, 25, 50, 100],
  'bupropion': [75, 100, 150, 300],
  'mirtazapine': [7.5, 15, 30, 45],
  'trazodone': [50, 100, 150, 300],
  'vortioxetine': [5, 10, 20],
  'vilazodone': [10, 20, 40],
  'amitriptyline': [10, 25, 50, 75, 100, 150],
  'nortriptyline': [10, 25, 50, 75],
  'imipramine': [10, 25, 50, 75],
  'desipramine': [10, 25, 50, 75, 100],
  'clomipramine': [25, 50, 75],
  'doxepin': [10, 25, 50, 75, 100],
  'protriptyline': [5, 10],
  'trimipramine': [25, 50, 100],
  'amoxapine': [25, 50, 100, 150],
  'maprotiline': [25, 50, 75],
  'phenelzine': [15],
  'tranylcypromine': [10],
  'isocarboxazid': [10],
  'moclobemide': [150, 300],
  'selegiline': [6, 9, 12],
  'nefazodone': [50, 100, 150, 200, 250],
  'agomelatine': [25],
  'reboxetine': [4],
  'esketamine': [28, 56, 84],
  'dextromethorphan-bupropion': [45],
  'gepirone': [18.2, 36.3, 54.5, 72.6],
  'quetiapine': [25, 50, 100, 200, 300, 400],
  'olanzapine': [2.5, 5, 7.5, 10, 15, 20],
  'risperidone': [0.25, 0.5, 1, 2, 3, 4],
  'aripiprazole': [2, 5, 10, 15, 20, 30],
  'ziprasidone': [20, 40, 60, 80],
  'lurasidone': [20, 40, 60, 80, 120],
  'paliperidone': [1.5, 3, 6, 9],
  'clozapine': [25, 50, 100, 200],
  'asenapine': [5, 10],
  'iloperidone': [1, 2, 4, 6, 8, 10, 12],
  'cariprazine': [1.5, 3, 4.5, 6],
  'brexpiprazole': [0.25, 0.5, 1, 2, 3, 4],
  'lumateperone': [42],
  'haloperidol': [0.5, 1, 2, 5, 10, 20],
  'chlorpromazine': [10, 25, 50, 100, 200],
  'fluphenazine': [1, 2.5, 5, 10],
  'perphenazine': [2, 4, 8, 16],
  'loxapine': [5, 10, 25, 50],
  'thioridazine': [10, 25, 50, 100],
  'trifluoperazine': [1, 2, 5, 10],
  'thiothixene': [1, 2, 5, 10],
  'pimozide': [1, 2],
  'flupentixol': [0.5, 1, 3],
  'zuclopenthixol': [10, 25],
  'lithium': [150, 300, 600],
  'valproate': [125, 250, 500],
  'lamotrigine': [25, 100, 150, 200],
  'carbamazepine': [100, 200, 400],
  'oxcarbazepine': [150, 300, 600],
  'topiramate': [25, 50, 100, 200],
  'atorvastatin': [10, 20, 40, 80],
  'rosuvastatin': [5, 10, 20, 40],
  'simvastatin': [5, 10, 20, 40, 80],
  'pravastatin': [10, 20, 40, 80],
  'lovastatin': [10, 20, 40],
  'fluvastatin': [20, 40, 80],
  'pitavastatin': [1, 2, 4]
};

let content = fs.readFileSync('lib/drug-db.ts', 'utf-8');

// Add availableDoses to interface
content = content.replace(
  'cns: SideEffectLevel;\n}',
  'cns: SideEffectLevel;\n  availableDoses: number[];\n}'
);

// Add availableDoses to each drug
for (const [drug, doseArr] of Object.entries(doses)) {
  const regex = new RegExp(`('${drug}':\\s*{[^}]+)(})`, 'g');
  content = content.replace(regex, `$1, availableDoses: [${doseArr.join(', ')}] $2`);
}

fs.writeFileSync('lib/drug-db.ts', content);
