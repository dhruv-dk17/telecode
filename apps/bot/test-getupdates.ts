import https from 'https';

console.log('Fetching getUpdates via https.get...');
https.get('https://api.telegram.org/bot8598391392:AAHe6dJbWcG5EoszAzCC3-S_hCattKZLJvQ/getUpdates', (res) => {
  console.log('Status Code:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Response:', data);
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('Error:', err);
  process.exit(1);
});
