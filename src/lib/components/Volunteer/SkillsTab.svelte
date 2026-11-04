<script lang="ts">
	import { ALL_ROLES } from '$lib/volunteerRoles';

	let { form }: { form: any } = $props();

	function toggleSkill(skill: string, on: boolean) {
		const skills: string[] = $form.skills.filter((x: string) => x !== skill);
		if (on) skills.push(skill);
		$form.skills = ALL_ROLES.filter((r) => skills.includes(r));
	}
</script>

<section class="tab-section">
	<h2 class="section-title mb-1">Skills</h2>
	<p class="mb-4 hint">A volunteer can only sign up for shift spots in roles they have the skill for.</p>
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
		{#each ALL_ROLES as skill (skill)}
			<label class="check-label">
				<input type="checkbox" checked={$form.skills.includes(skill)} onchange={(e) => toggleSkill(skill, (e.currentTarget as HTMLInputElement).checked)} />
				{skill}
			</label>
		{/each}
	</div>
</section>
