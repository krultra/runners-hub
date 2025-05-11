const fs = require('fs');
const path = '/home/torgeir-kruke/CascadeProjects/runners-hub/src/pages/ResultsPage.tsx';
const content = fs.readFileSync(path, 'utf8');

// Update all age valueGetter definitions
const updatedContent = content.replace(
  /valueGetter: \(params\) => \{\s*if \(params\.row\.age\) return params\.row\.age;\s*if \(params\.row\.dateOfBirth\) \{\s*const birthYear = new Date\(params\.row\.dateOfBirth\)\.getFullYear\(\);\s*const currentYear = new Date\(\)\.getFullYear\(\);\s*return currentYear - birthYear;\s*\}\s*return '';\s*\}/g,
  `valueGetter: (params) => {
        // First try to get age from moRegistrations.age
        if (params.row.moRegistrations?.age) return params.row.moRegistrations.age;
        // Otherwise return empty string
        return '';
      }`
);

fs.writeFileSync(path, updatedContent);
console.log('Updated age valueGetter definitions in ResultsPage.tsx');
