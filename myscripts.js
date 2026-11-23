// get current date 
const today = new Date();


const formattedDate = today.toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
document.getElementById('date-display').textContent = formattedDate;
