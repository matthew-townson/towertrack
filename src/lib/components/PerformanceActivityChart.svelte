<script>
	import { onMount } from 'svelte';

	export let periods = [];
	export let onSelect = () => {};
	export let label = 'Performances';

	let canvas;
	let chart;

	onMount(() => {
		let disposed = false;
		import('chart.js').then(({ Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip }) => {
			if (disposed) return;
			Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
			chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: periods.map((period) => period.label),
				datasets: [{
					label,
					data: periods.map((period) => period.value ?? period.performances ?? period.grabs),
					backgroundColor: '#3e8ed0',
					hoverBackgroundColor: '#48c78e',
					borderRadius: 4,
					maxBarThickness: 36
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					intersect: false,
					mode: 'index'
				},
				onClick: (_event, elements) => {
					const element = elements[0];
					if (element) onSelect(periods[element.index]);
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (context) => `${context.parsed.y} ${label.toLowerCase()}`
						}
					}
				},
				scales: {
					x: {
						grid: { display: false },
						ticks: { maxRotation: 45, minRotation: 45 }
					},
					y: {
						beginAtZero: true,
						ticks: { precision: 0 },
						grid: { color: 'rgba(128, 128, 128, 0.2)' }
					}
				}
			}
			});
		});

		return () => {
			disposed = true;
			chart?.destroy();
		};
	});
</script>

<div class="performance-activity-chart">
	<canvas bind:this={canvas} aria-label="Performance activity over time"></canvas>
</div>

<style>
	.performance-activity-chart {
		position: relative;
		width: 100%;
		height: 280px !important;
		min-height: 280px;
		max-height: 280px;
		overflow: hidden;
	}

	canvas {
		display: block;
		position: absolute;
		inset: 0;
		width: 100% !important;
		height: 100% !important;
	}
</style>
