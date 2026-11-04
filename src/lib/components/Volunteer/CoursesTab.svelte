<script lang="ts">
	import { Button, Input, Label } from 'flowbite-svelte';
	import { PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import FieldError from '$lib/components/FieldError.svelte';

	let { form, errors }: { form: any; errors: any } = $props();

	function addCourse() {
		$form.trainingCourses = [...$form.trainingCourses, { name: '', completed: '' }];
	}
	function removeCourse(i: number) {
		$form.trainingCourses = $form.trainingCourses.filter((_: unknown, n: number) => n !== i);
	}
</script>

<section class="tab-section">
	<h2 class="section-title">Training courses</h2>
	{#if $form.trainingCourses.length === 0}
		<p class="mb-3 hint">No courses recorded.</p>
	{/if}
	<div class="space-y-3">
		{#each $form.trainingCourses as _course, i (i)}
			<div class="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_11rem_auto]">
				<div class="min-w-0">
					<Label for={`course-name-${i}`} class="sm:sr-only">Course</Label>
					<Input id={`course-name-${i}`} placeholder="Course name" bind:value={$form.trainingCourses[i].name} />
					<FieldError messages={$errors.trainingCourses?.[i]?.name} />
				</div>
				<div class="min-w-0">
					<Label for={`course-date-${i}`} class="sm:sr-only">Completed</Label>
					<Input id={`course-date-${i}`} type="date" bind:value={$form.trainingCourses[i].completed} />
					<FieldError messages={$errors.trainingCourses?.[i]?.completed} />
				</div>
				<Button type="button" outline color="red" size="sm" aria-label="Remove course" onclick={() => removeCourse(i)}>
					<TrashBinOutline class="h-4 w-4" />
				</Button>
			</div>
		{/each}
	</div>
	<Button type="button" outline color="dark" size="sm" class="mt-3" onclick={addCourse}>
		<PlusOutline class="mr-2 h-3.5 w-3.5" />Add course
	</Button>
</section>
