<script>
	import { goto } from '$app/navigation';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';

	export let data;

	let notifications = data.notifications;

	async function handleNotificationClick(notification) {
		// Mark as read
		if (!notification.isRead) {
			try {
				await fetch(`/api/notifications/${notification.id}`, { method: 'PATCH' });
				notification.isRead = true;
				notifications = [...notifications];
			} catch (err) {
				console.error('Failed to mark notification as read:', err);
			}
		}
		
		// Handle navigation based on type
		const notifData = typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data;
		
		if (notification.type === 'calendar_invitation') {
			goto(`/calendar?showInvitation=${notifData.eventId}`);
		} else if (notification.type === 'invitation_response') {
			goto('/calendar');
		}
	}

	async function markAllRead() {
		try {
			await fetch('/api/notifications/mark-all-read', { method: 'POST' });
			notifications = notifications.map(n => ({ ...n, isRead: true }));
		} catch (err) {
			console.error('Failed to mark all as read:', err);
		}
	}

	async function deleteNotification(id, event) {
		event.stopPropagation();
		try {
			await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
			notifications = notifications.filter(n => n.id !== id);
		} catch (err) {
			console.error('Failed to delete notification:', err);
		}
	}

	function formatDate(dateStr) {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
		if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
		if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
		return date.toLocaleDateString();
	}

	$: unreadCount = notifications.filter(n => !n.isRead).length;
</script>

<svelte:head>
	<title>Notifications - TowerTracker</title>
</svelte:head>

<Header user={data.user} />

<main class="section">
	<div class="container">
		<div class="columns is-centered">
			<div class="column is-8">
				<div class="box">
					<div class="level mb-4">
						<div class="level-left">
							<div class="level-item">
								<h1 class="title is-4">
									Notifications
									{#if unreadCount > 0}
										<span class="tag is-info ml-2">{unreadCount} unread</span>
									{/if}
								</h1>
							</div>
						</div>
						<div class="level-right">
							{#if unreadCount > 0}
								<div class="level-item">
									<button class="button is-small" on:click={markAllRead}>
										Mark all as read
									</button>
								</div>
							{/if}
						</div>
					</div>

					{#if notifications.length === 0}
						<div class="has-text-centered py-6">
							<p class="has-text-grey is-size-5">No notifications yet</p>
							<p class="has-text-grey is-size-7 mt-2">You'll see notifications here when you're invited to events or receive updates.</p>
						</div>
					{:else}
						<div class="notification-list">
							{#each notifications as notification}
								<div 
									class="notification-row"
									class:unread={!notification.isRead}
									role="button"
									tabindex="0"
									on:click={() => handleNotificationClick(notification)}
									on:keydown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
								>
									<div class="notification-icon">
										{#if notification.type === 'calendar_invitation'}
											📅
										{:else if notification.type === 'invitation_response'}
											✉️
										{:else}
											🔔
										{/if}
									</div>
									<div class="notification-body">
										<p class="notification-title">{notification.title}</p>
										<p class="notification-message">{notification.message}</p>
										<p class="notification-time">{formatDate(notification.createdAt)}</p>
									</div>
									<div class="notification-actions">
										{#if !notification.isRead}
											<span class="unread-indicator"></span>
										{/if}
										<button 
											class="delete is-small" 
											on:click={(e) => deleteNotification(notification.id, e)}
											aria-label="Delete notification"
										></button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</main>

<Footer />

<style>
	.notification-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.notification-row {
		display: flex;
		align-items: flex-start;
		padding: 1rem;
		border-radius: 6px;
		cursor: pointer;
		transition: background-color 0.2s;
		border: 1px solid #e8e8e8;
	}

	.notification-row:hover {
		background-color: #f5f5f5;
	}

	.notification-row.unread {
		background-color: #f0f7ff;
		border-color: #b3d4ff;
	}

	.notification-row.unread:hover {
		background-color: #e6f0ff;
	}

	.notification-icon {
		font-size: 1.5rem;
		margin-right: 1rem;
		flex-shrink: 0;
	}

	.notification-body {
		flex: 1;
		min-width: 0;
	}

	.notification-title {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.notification-message {
		color: #666;
		font-size: 0.9rem;
		margin-bottom: 0.25rem;
	}

	.notification-time {
		color: #999;
		font-size: 0.8rem;
	}

	.notification-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: 1rem;
	}

	.unread-indicator {
		width: 10px;
		height: 10px;
		background-color: #3273dc;
		border-radius: 50%;
	}

	@media (prefers-color-scheme: dark) {
		.notification-row {
			border-color: #3a3a3a;
		}

		.notification-row:hover {
			background-color: #3a3a3a;
		}

		.notification-row.unread {
			background-color: #2a3a4a;
			border-color: #3a5a7a;
		}

		.notification-row.unread:hover {
			background-color: #2f4050;
		}

		.notification-message {
			color: #aaa;
		}

		.notification-time {
			color: #777;
		}
	}
</style>
