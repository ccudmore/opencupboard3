<script lang="ts">
  import { page } from '$app/state';
  import { Button, Heading, P } from 'flowbite-svelte';
</script>

<section class="bg-white dark:bg-gray-900 h-screen flex items-center">
  <div class="py-8 px-4 mx-auto max-w-7xl lg:py-16 lg:px-6">
    <div class="mx-auto max-w-screen-sm text-center">
      <!-- Big Error Status Code (e.g., 404) -->
      <Heading 
        tag="h1" 
        class="mb-4 text-7xl tracking-tight font-extrabold lg:text-9xl text-primary-600 dark:text-primary-500"
      >
        {page.status}
      </Heading>
      
      <!-- Error Message title -->
      <Heading 
        tag="h2" 
        class="mb-4 text-3xl md:text-4xl tracking-tight font-bold text-gray-900 dark:text-white"
      >
        {#if page.status === 404}
          Something's missing.
        {:else}
          An unexpected error occurred.
        {/if}
      </Heading>
      
      <!-- Description Paragraph -->
      <P class="mb-4 text-lg font-light text-gray-500 dark:text-gray-400">
        {#if page.status === 404}
          Sorry, we can't find that page. You'll find lots to explore on the home page.
        {:else}
          {page.error?.message || 'Please try again later.'}
        {/if}
      </P>
      
      <!-- Back to Home Button -->
      <Button 
        href="/" 
        class="inline-flex text-gray-500 bg-primary-600 hover:bg-primary-800 focus:ring-4 focus:outline-none focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:focus:ring-primary-900 my-4 dark:text-white"
      >
        Back to Homepage
      </Button>
    </div>   
  </div>
</section>








<!---
  <h1>{page.status}</h1>
  <p>{page.error?.message}</p>

  <a href="/">Go back home</a>
-->