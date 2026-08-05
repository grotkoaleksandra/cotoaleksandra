// Dateline — today's date, broadsheet style
const dateline = document.getElementById('dateline');
dateline.textContent = new Date()
  .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  .toUpperCase();

// Scroll reveal for exhibits and lab items
document.documentElement.classList.add('reveal-ready');
const targets = document.querySelectorAll('.exhibit, .labitem, .front__lead, .front__facts, .letters__mail');
targets.forEach((el) => el.classList.add('reveal'));
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
