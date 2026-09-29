<script>
  import { page } from '$app/state';
</script>

<div class="error-page">
  <h1>{page.status}</h1>
  <p>{page.error?.message}</p>

  <a href="/">Go back home</a>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    text-align: center;
    gap: 1rem;
  }

  h1 {
    font-size: 3rem;
    margin: 0;
  }
</style>