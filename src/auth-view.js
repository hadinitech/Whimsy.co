const paths = {
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  lock: '<rect x="6" y="10" width="12" height="11" rx="2"/><path d="M9 10V6a3 3 0 0 1 6 0v4m-3 5v2"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 10V5a3 3 0 0 1 6 0v5"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3.1 3.9M6.2 6.2A22 22 0 0 0 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
const field = (id, label, type, autocomplete, extra = '') => `<label for="${id}">${label}</label><div class="auth-input${type === 'password' ? ' auth-password' : ''}">${icon(id === 'name' ? 'person' : id === 'email' ? 'email' : 'lock')}<input id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}" ${extra} required>${type === 'password' ? `<button type="button" class="password-toggle" data-toggle-password aria-label="Show password" aria-controls="${id}">${icon('eye')}</button>` : ''}</div>`;

export function bindPasswordVisibility(root) {
  root.querySelectorAll('[data-toggle-password]').forEach(button => {
    const input = button.parentElement.querySelector('input');
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      button.innerHTML = icon(show ? 'eyeOff' : 'eye');
    });
  });
}

export function authView(mode) {
  const recovery = mode === 'update';
  const heading = { login: 'Your little corner', signup: 'A little more you', reset: 'Forgot your password?', update: 'A fresh start' }[mode];
  const eyebrow = { login: 'WELCOME BACK', signup: 'MAKE YOURSELF AT HOME', reset: 'LET’S GET YOU BACK IN', update: 'YOUR LITTLE RESET' }[mode];
  const copy = { login: 'Sign in to keep your details, save your favourites, and find all your orders in one place.', signup: 'Create an account to keep your details, save your bag, and make yourself at home.', reset: 'Enter your email and we’ll send you a link to reset your password.', update: 'Choose a new password for your own little corner of Whimsy.' }[mode];
  return `<div class="auth-cards">
    <section class="auth-login" aria-labelledby="auth-heading">
      <div class="auth-eyebrow">${eyebrow}</div>
      <div class="auth-heading"><h1 id="auth-heading">${heading}</h1><svg viewBox="0 0 34 38" class="auth-sparks" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="m6 28 8-22m-1 25 18-12"/></svg></div>
      <p class="auth-copy">${copy}</p>
      <form id="auth-form" class="store-form auth-form">
        ${mode === 'signup' ? field('name', 'Your name', 'text', 'name', 'maxlength="100"') : ''}
        ${!recovery ? field('email', 'Email', 'email', 'email', 'maxlength="254"') : ''}
        ${mode !== 'reset' ? field('password', recovery ? 'New password' : 'Password', 'password', mode === 'login' ? 'current-password' : 'new-password', 'minlength="8" maxlength="128"') : ''}
        <button class="store-button auth-submit" type="submit"><span>${{ login: 'Sign in', signup: 'Create account', reset: 'Send reset link', update: 'Save password' }[mode]}</span>${icon('arrow')}</button>
        <div class="auth-help">${mode === 'login' ? '<button class="text-button" type="button" data-mode="reset">Forgot password?</button>' : '<button class="text-button" type="button" data-mode="login">Back to sign in</button>'}</div>
        <div class="form-result" role="status" aria-live="polite"></div>
      </form>
    </section>
    <aside class="auth-benefits" aria-labelledby="benefits-heading">
      <svg class="benefits-sparks" viewBox="0 0 36 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m7 15 3-10m6 17 12-8m-9 18h10"/></svg>
      <h2 id="benefits-heading">Your own corner <br>of chaos.</h2>
      <p class="auth-copy">Save your details, keep your bag across devices, and find all your orders in one place.</p>
      <ul class="auth-benefit-list">
        <li><span class="benefit-icon">${icon('heart')}</span><div><h3>Save your favourites</h3><p>Keep track of the little things you love.</p></div></li>
        <li><span class="benefit-icon">${icon('bag')}</span><div><h3>Access your orders</h3><p>View order history and tracking.</p></div></li>
        <li><span class="benefit-icon">${icon('phone')}</span><div><h3>Seamless across devices</h3><p>Pick up right where you left off.</p></div></li>
      </ul>
      <svg class="benefits-loop" viewBox="0 0 86 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 39c17-15 29-14 37-20 16-13-7-22-7-10 0 24 30 12 49-15M22 26c6 16 23 15 29 2"/></svg>
    </aside>
  </div>
  <p class="auth-create">${mode === 'login' ? 'New to the little chaos? <button type="button" class="text-button" data-mode="signup">Create an account</button>' : '<a href="policies.html#privacy">Your details, looked after.</a>'}</p>`;
}
