<script>
import { onMount } from 'svelte';
import { goto } from '$app/navigation';

export let user = null;
let menuOpen = false;
let notificationsOpen = false;
let activeDropdown = null;
let notifications = [];
let totalNotifications = 0;
let unreadCount = 0;
let showMigrationModal = false;

$: userSlug = user ? user.username.replace(/ /g, '-') : '';

function closeMenus() {
  menuOpen = false;
  notificationsOpen = false;
  activeDropdown = null;
}

function toggleDropdown(name) {
  if (activeDropdown === name) {
    activeDropdown = null;
  } else {
    activeDropdown = name;
    notificationsOpen = false;
  }
}

function handleClickOutside(event) {
  const navbar = event.target.closest('.navbar');
  const hamburger = event.target.closest('.navbar-burger');
  const dropdown = event.target.closest('.navbar-item.has-dropdown');
  
  // Never close if clicking the hamburger button
  if (hamburger) return;
  
  if (!navbar) {
    // Clicked outside navbar entirely
    notificationsOpen = false;
    activeDropdown = null;
  } else if (navbar && !dropdown) {
    // Clicked inside navbar but not on a dropdown toggle
    // Only close if it was a regular navbar item, not a dropdown button
    const isNavbarItem = event.target.closest('.navbar-item:not(.has-dropdown)');
    if (isNavbarItem) {
      notificationsOpen = false;
      activeDropdown = null;
    }
  }
}

async function loadNotifications() {
  if (!user) return;
  try {
    const res = await fetch('/api/notifications?limit=10');
    if (res.ok) {
      const data = await res.json();
      notifications = data.notifications;
      totalNotifications = data.total;
      unreadCount = data.unreadCount;
    }
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
}

async function handleNotificationClick(notification) {
  if (!notification.isRead) {
    try {
      await fetch(`/api/notifications/${notification.id}`, { method: 'PATCH' });
      notification.isRead = true;
      unreadCount = Math.max(0, unreadCount - 1);
      notifications = [...notifications];
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }

  if (notification.type === 'calendar_invitation') {
    const data = typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data;
    goto(`/calendar?showInvitation=${data.eventId}`);
  } else if (notification.type === 'invitation_response') {
    goto('/calendar');
  }

  notificationsOpen = false;
}

function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function dismissMigrationModal() {
	showMigrationModal = false;
	if (typeof window !== 'undefined') {
		localStorage.setItem('migrationModalDismissed', 'true');
	}
}

let showedMigrationCheck = false;

// Reactive check for user to show modal once user is available
$: if (user && !showedMigrationCheck && typeof window !== 'undefined') {
	showedMigrationCheck = true;
	if (window.location.hostname != 'towertracker.co.uk') {
		const dismissed = localStorage.getItem('migrationModalDismissed');
		if (!dismissed) {
			showMigrationModal = true;
		}
	}
}

onMount(() => {
	loadNotifications();
	const interval = setInterval(loadNotifications, 60000);
	document.addEventListener('click', handleClickOutside);
	return () => {
		clearInterval(interval);
		document.removeEventListener('click', handleClickOutside);
	};
});
</script>

<nav class="navbar has-shadow is-spaced custom-banner-bg" aria-label="main navigation">
  <div class="navbar-brand">
    <a class="navbar-item" href="/">
      <h1 class="title is-4 has-text-white">towertracker</h1>
    </a>
    <button type="button"
      class="navbar-burger has-text-white"
      aria-label="menu"
      aria-expanded={menuOpen}
      on:click|stopPropagation={() => menuOpen = !menuOpen}
    >
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
    </button>
  </div>

  <div class="navbar-menu" class:is-active={menuOpen}>
    <div class="navbar-start">
      {#if user}
        <a class="navbar-item has-text-white" href="/home" on:click={closeMenus}>Home</a>

        <div class="navbar-item has-dropdown" class:is-active={activeDropdown === 'explore'}>
          <button class="navbar-link has-text-white" type="button" on:click|stopPropagation={() => toggleDropdown('explore')}>
            Explore
          </button>
          <div class="navbar-dropdown">
            <a class="navbar-item" href="/tower/search" on:click={closeMenus}>Towers</a>
            <a class="navbar-item" href="/u/search" on:click={closeMenus}>Users</a>
            <a class="navbar-item" href="/map" on:click={closeMenus}>Map</a>
            <hr class="navbar-divider">
            <a class="navbar-item" href="/updates" on:click={closeMenus}>Updates</a>
            <a class="navbar-item" href="/roadmap" on:click={closeMenus}>Roadmap</a>
          </div>
        </div>

        <div class="navbar-item has-dropdown" class:is-active={activeDropdown === 'activity'}>
          <button class="navbar-link has-text-white" type="button" on:click|stopPropagation={() => toggleDropdown('activity')}>
            My Activity
          </button>
          <div class="navbar-dropdown">
            <a class="navbar-item" href="/u/{userSlug}" on:click={closeMenus}>My Profile</a>
            <a class="navbar-item" href="/statistics" on:click={closeMenus}>Statistics</a>
            <a class="navbar-item" href="/u/{userSlug}/performance-data" on:click={closeMenus}>Performance Data</a>
            <a class="navbar-item" href="/grab" on:click={closeMenus}>Grabs</a>
          </div>
        </div>

        <div class="navbar-item has-dropdown" class:is-active={activeDropdown === 'organise'}>
          <button class="navbar-link has-text-white" type="button" on:click|stopPropagation={() => toggleDropdown('organise')}>
            Organise
          </button>
          <div class="navbar-dropdown">
            <a class="navbar-item" href="/calendar" on:click={closeMenus}>Calendar</a>
            <hr class="navbar-divider">
            <a class="navbar-item" href="/lists" on:click={closeMenus}>Lists <b style="font-size: 0.75em; opacity: 0.7;">[Alpha]</b></a>
          </div>
        </div>
      {:else}
        <a class="navbar-item has-text-white" href="/">Home</a>
        <a class="navbar-item has-text-white" href="/about">About</a>
      {/if}
    </div>

    <div class="navbar-end">
      {#if user}
        {#if user.permission === 0}
          <a class="navbar-item has-text-white" href="/admin" on:click={closeMenus}>Admin</a>
        {/if}

        <div class="navbar-item has-dropdown" class:is-active={notificationsOpen}>
          <button
            class="navbar-link notification-bell"
            on:click|stopPropagation={() => { notificationsOpen = !notificationsOpen; activeDropdown = null; }}
            aria-label="Notifications"
          >
            🔔
            {#if unreadCount > 0}
              <span class="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            {/if}
          </button>

          <div class="navbar-dropdown is-right notification-dropdown">
            <div class="notification-header">
              <span class="has-text-weight-bold">Notifications</span>
              {#if unreadCount > 0}
                <button
                  class="button is-small is-text"
                  on:click={async () => {
                    await fetch('/api/notifications/mark-all-read', { method: 'POST' });
                    notifications = notifications.map(n => ({ ...n, isRead: true }));
                    unreadCount = 0;
                  }}
                >
                  Mark all read
                </button>
              {/if}
            </div>

            <hr class="navbar-divider">

            {#if notifications.length === 0}
              <div class="notification-empty"><p class="has-text-grey">No notifications</p></div>
            {:else}
              {#each notifications as notification}
                <button
                  class="notification-item"
                  class:unread={!notification.isRead}
                  on:click={() => handleNotificationClick(notification)}
                >
                  <div class="notification-content">
                    <p class="notification-title">{notification.title}</p>
                    <p class="notification-message">{notification.message}</p>
                    <p class="notification-time">{formatTimeAgo(notification.createdAt)}</p>
                  </div>
                  {#if !notification.isRead}
                    <span class="unread-dot"></span>
                  {/if}
                </button>
              {/each}

              {#if totalNotifications > 10}
                <div class="notification-more has-text-centered has-text-grey is-size-7" style="padding: 0.75rem 1rem;">
                  View {totalNotifications - 10} more notification{totalNotifications - 10 === 1 ? '' : 's'}
                </div>
              {/if}
            {/if}

            <hr class="navbar-divider" style="margin: 0;">
            <a href="/notifications" class="navbar-item has-text-centered" on:click={closeMenus}>View all notifications</a>
          </div>
        </div>

        <div class="navbar-item has-dropdown" class:is-active={activeDropdown === 'user'}>
          <button class="navbar-link has-text-white" type="button" on:click|stopPropagation={() => toggleDropdown('user')}>{user.username}</button>
          <div class="navbar-dropdown is-right">
            <a class="navbar-item" href="/notifications" on:click={closeMenus}>Notifications {#if unreadCount > 0}<span class="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>{/if}</a>
            <a class="navbar-item" href="/account/settings" on:click={closeMenus}>Settings</a>
            <hr class="navbar-divider">
            <a class="navbar-item" href="/account/logout" on:click={closeMenus}>Logout</a>
          </div>
        </div>
      {:else}
        <a class="navbar-item has-text-white" href="/account/register">Register</a>
        <a class="navbar-item has-text-white" href="/account/login">Login</a>
      {/if}
    </div>
  </div>

</nav>

<!-- Migration Modal -->
{#if showMigrationModal && user}
	<div class="modal is-active">
		<div class="modal-background" on:click={dismissMigrationModal} on:keydown={(e) => e.key === 'Escape' && dismissMigrationModal()} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">
					We're moving!
				</p>
				<button class="delete" aria-label="close" on:click={dismissMigrationModal}></button>
			</header>
			<section class="modal-card-body">
				<div class="content">
					<p>
						<strong>Towertracker</strong> is moving to its own domain!
					</p>
          <p>
            Available at <a href="https://towertracker.co.uk"><strong>towertracker.co.uk</strong></a>
          </p>
					<p>
						Towertracker will be available here for now, but please update your saved passwords and bookmarks to the new URL.
					</p>
				</div>
			</section>
			<footer class="modal-card-foot">
				<button class="button is-primary" on:click={() => window.location.href = 'https://towertracker.co.uk'}>
					Visit New Site →
				</button>
				<button class="button" on:click={dismissMigrationModal}>
					Dismiss
				</button>
			</footer>
		</div>
	</div>
{/if}

