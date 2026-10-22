<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	const baseUrl = page.url.origin; 

    const subscriptionUrl = `${baseUrl}/calendar.ics`;
	// webcal:// triggers external applications like Apple Calendar or Outlook
	const webcalUrl = subscriptionUrl.replace(/^https?:\/\//, 'webcal://');
    const googleCalendarUrl = `https://google.com${encodeURIComponent(subscriptionUrl)}`;

	function copyToClipboard() {
		navigator.clipboard.writeText(subscriptionUrl);
		alert('Calendar link copied to clipboard!');
	}
</script>

<div class="calendar-container">
	<h1>Subscribe to Our Calendar</h1>
	<p>Keep up with our events automatically by adding this feed to your preferred software.</p>

	<div class="actions">
		<!-- 1. Native application trigger -->
		<a href={webcalUrl} class="btn primary">
			Subscribe (Apple / Outlook)
		</a>

		<!-- 2. Google Calendar target -->
		<a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer" class="btn google">
			Add to Google Calendar
		</a>

		<!-- 3. Manual copy url -->
		<button onclick={copyToClipboard} class="btn secondary">
			Copy ICS Feed URL
		</button>
	</div>
	
	<div class="url-display">
		<code>{subscriptionUrl}</code>
	</div>
</div>

<style>
	.calendar-container { padding: 2rem; max-width: 600px; margin: 0 auto; text-align: center; }
	.actions { display: flex; flex-direction: column; gap: 1rem; margin: 2rem 0; }
	.btn { padding: 0.75rem 1.5rem; border-radius: 4px; text-decoration: none; font-weight: bold; cursor: pointer; border: none; }
	.primary { background-color: #ff3e00; color: white; }
	.google { background-color: #4285f4; color: white; }
	.secondary { background-color: #e2e8f0; color: #333; }
	.url-display { background: #f4f4f4; padding: 0.5rem; border-radius: 4px; overflow-x: auto; }
</style>
