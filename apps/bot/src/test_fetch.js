async function test() {
    const token = '8598391392:AAHe6dJbWcG5EoszAzCC3-S_hCattKZLJvQ';
    console.log('Testing fetch to Telegram API...');
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await res.json();
        console.log('Success:', data);
    } catch (err) {
        console.error('Error:', err);
    }
}
test();
