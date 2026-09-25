<script lang="ts">
        import type { PageData } from './$types';
        let { data }: { data: PageData } = $props();
</script>
<br>
<br>
<br>
<br>
<br>
<br>
<h1>SvelteKit + Prisma 7 + Better Auth</h1>





{#if data.user}
        <p>Signed in as <strong>{data.user.email}</strong> (roles: {data.user.roles.join(', ') || 'none'}).</p>
        <p>Signed in as <strong>{data.user.email}</strong> (permissions: {data.user.permissions[0].path || 'none'}).</p>

        <p><a href="/dashboard">Go to your dashboard →</a></p>
{:else}
        <p>This is a public page — no auth required.</p>
        <p><a href="/login">Sign in</a> or <a href="/register">create an account</a>.</p>
{/if}

<h2>Try the protected routes</h2>
<ul>
        <li><code>/dashboard</code> — any signed-in user</li>
        <li><code>/reports</code> — requires the <code>reports:view</code> permission (manager/admin by default)</li>
        <li><code>/admin</code> — requires the <code>admin</code> role</li>
</ul>