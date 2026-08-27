async function fetchSPs() {
  try {
    const res = await fetch('http://localhost:3001/api/sps');
    if (!res.ok) throw new Error('Failed to fetch');
    const sps = await res.json();
    console.log('Stored Procedures:', sps.length);
    
    const targets = [
      'usp_UpsertTeachingLog',
      'usp_GetTeachingLogByID',
      'usp_GetTeachingLogByFilters',
      'usp_GetTeachingLogByFilters_V2',
      'usp_GetDaywiseTeachingLogCounts'
    ];
    
    for (const sp of targets) {
      const analyzeRes = await fetch(`http://localhost:3001/api/sps/dbo/${sp}/analyze`);
      if (analyzeRes.ok) {
        const data = await analyzeRes.json();
        const fs = require('fs');
        fs.writeFileSync(`sp_${sp}.json`, JSON.stringify(data, null, 2));
        console.log(`Saved analysis for ${sp}`);
      } else {
        console.log(`Failed to analyze ${sp}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}
fetchSPs();
