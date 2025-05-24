<script>
  export let error;
  export let status;
</script>

<div class="error-page">
  <h1>ERROR {status ?? 500}</h1>
  <h2>Oops! Something went wrong.</h2>
  <p>{error?.message ?? 'An unexpected error occurred.'}</p>
  <a href="/">Go home</a>
</div>

<footer>
	<p>&copy; {new Date().getFullYear()} <a href="https://mtownson.com" target="_blank">Matthew Townson</a>. All rights reserved.<br><br>
	<a href="https://mtownson.com" target="_blank"><img src="/assets/image/matthewnow.gif" alt="Matthew NOW!" title="Matthew NOW!"/></a>
    <img src="/assets/image/linuxpowered.gif" alt="Powered by Linux" title="Powered by Linux"/>
    </p>
</footer>

<style>
.error-page {
  text-align: center;
  padding: 4rem 1rem;
}
.error-page h1 {
  font-size: 5rem;
  color: #C33C54;
}
.error-page h2 {
  margin-top: 1rem;
  color: #374151;
}
.error-page a {
  display: inline-block;
  margin-top: 2rem;
  color: #C33C54;
  text-decoration: underline;
  font-weight: bold;
}
</style>