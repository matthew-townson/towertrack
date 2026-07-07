<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import UserSearch from '$lib/components/UserSearch.svelte';

	export let data;

	let calendars = data.calendars;
	let events = data.events;
	let organisedEvents = data.organisedEvents;
	let invitations = data.invitations;
	let sharedCalendars = data.sharedCalendars || [];
	let sharedEvents = data.sharedEvents || [];
	let currentDate = new Date();
	let viewMode = 'month'; // month, week
	let selectedCalendars = calendars.map(c => c.id);
	let selectedSharedCalendars = sharedCalendars.map(c => c.id);
	let weekBodyElement = null; // Reference to week body for scrolling
	let viewModeLoaded = false; // Flag to track if we've loaded the saved preference
	let yearInput = String(currentDate.getFullYear());

	
	// Sidebar tab state
	let sidebarTab = 'calendars'; // calendars, myEvents, invitations

	// Modal states
	let showEventModal = false;
	let showViewEventModal = false;
	let showViewSharedEventModal = false;
	let showCalendarModal = false;
	let showSettingsModal = false;
	let showRecurrenceEditModal = false;
	let showSharedRecurrenceEditModal = false;
	let showSharedCalendarModal = false;
	let showManageSharedCalendarModal = false;
	let sharedEventModalTab = 'details'; // details or invitations
	let eventModalTab = 'details'; // details or invitations (for regular events)
	let editingEvent = null;
	let viewingEvent = null;
	let viewingSharedEvent = null;
	let viewingEventInvitations = [];
	let loadingInvitations = false;
	let editingCalendar = null;
	let pendingRecurrenceEdit = null; // Stores the event pending recurrence edit choice
	let pendingSharedRecurrenceEdit = null; // Stores the shared event pending recurrence edit choice
	let sharedEventInvitations = []; // Invitations for the currently viewed shared event
	let regularEventInvitations = []; // Invitations for the currently edited regular event
	let loadingEventInvitations = false;
	let inviteForm = {
		invitedUserId: null,
		guestName: '',
		instanceDate: null
	};
	let inviteSearchQuery = '';
	let inviteSearchResults = [];
	let searchingInvites = false;

	// Shared calendar state
	let managingSharedCalendar = null;
	let sharedCalendarMembers = [];
	let loadingSharedMembers = false;
	let sharedCalendarForm = { name: '', colour: '#3788d8' };
	let transferTargetUserId = null;
	let savingSharedCalendar = false;
	
	// Tower search state
	let towerSearch = '';
	let towerResults = [];
	let selectedTower = null;
	let searchingTowers = false;
	
	// Invited users state
	let invitedUsers = []; // Can contain both users (with id) and guests (with guestName)
	let guestNameInput = '';

	// User lists for inviting multiple ringers
	let userLists = [];
	let selectedUserListId = '';
	let selectedListMembers = [];
	let loadingUserLists = false;
	let loadingListMembers = false;

	// Event form
	let eventForm = {
		calendarId: calendars[0]?.id || '',
		title: '',
		description: '',
		location: '',
		towerID: null,
		method: '',
		composition: '',
		startDate: '',
		startTime: '',
		endDate: '',
		endTime: '',
		allDay: false,
		recurrenceType: 'none',
		recurrenceInterval: 1,
		recurrenceEndDate: ''
	};

	// Calendar form
	let calendarForm = {
		name: '',
		colour: '#3788d8'
	};

	// iCal settings
	let icalSecret = null;
	let loadingSecret = false;

	// Dropdown menu state
	let openMenuId = null;

	// Notification state
	let notification = null;
	let notificationTimeout = null;

	function showNotification(message, type = 'success') {
		if (notificationTimeout) clearTimeout(notificationTimeout);
		notification = { message, type };
		notificationTimeout = setTimeout(() => {
			notification = null;
		}, 3000);
	}

	function getRecurrenceDescription(type, interval, endDate, startDate) {
		if (!type || type === 'none') return 'Does not repeat';
		
		const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		const ordinals = ['', '1st', '2nd', '3rd', '4th', 'last'];
		
		let desc = 'Every ';
		if (interval > 1) desc += `${interval} `;
		
		switch (type) {
			case 'daily': desc += interval === 1 ? 'day' : 'days'; break;
			case 'weekly': desc += interval === 1 ? 'week' : 'weeks'; break;
			case 'monthly': desc += interval === 1 ? 'month' : 'months'; break;
			case 'monthly_nth': {
				if (startDate) {
					const date = parseEventDateTimeLocal(startDate);
					if (!date) break;
					const weekday = date.getDay();
					const nth = Math.ceil(date.getDate() / 7);
					const ordinal = nth <= 4 ? ordinals[nth] : 'last';
					desc = `Every ${interval > 1 ? interval + ' months on the ' : ''}${ordinal} ${weekdays[weekday]}`;
				} else {
					desc += interval === 1 ? 'month (nth weekday)' : 'months (nth weekday)';
				}
				break;
			}
			case 'yearly': desc += interval === 1 ? 'year' : 'years'; break;
		}
		
		if (endDate) {
			const end = parseEventDateTimeLocal(endDate);
			if (!end) return desc;
			desc += ` until ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
		}
		
		return desc;
	}

	// Tower search functions
	async function searchTowers(query) {
		if (!query || query.trim().length < 2) {
			towerResults = [];
			return;
		}
		
		searchingTowers = true;
		try {
			const response = await fetch(`/api/search-towers?query=${encodeURIComponent(query)}`);
			if (response.ok) {
				towerResults = await response.json();
			}
		} catch (error) {
			console.error('Tower search error:', error);
			towerResults = [];
		} finally {
			searchingTowers = false;
		}
	}
	
	function selectTower(tower) {
		selectedTower = tower;
		eventForm.towerID = tower.TowerID;
		eventForm.location = `${tower.Place}, ${tower.Dedicn}`;
		towerSearch = `${tower.Place}, ${tower.Dedicn}`;
		towerResults = [];
	}
	
	function clearTower() {
		selectedTower = null;
		eventForm.towerID = null;
		towerSearch = '';
	}
	
	// Invitation functions
	function addInvitedUser(user) {
		if (!invitedUsers.find(u => u.id === user.id)) {
			if (user.id === data.user.id) return; // Don't add self
			invitedUsers = [...invitedUsers, { ...user, isGuest: false }];
		}
	}
	
	function addGuestInvite() {
		const name = guestNameInput.trim();
		if (!name) return;
		// Check for duplicate guest names
		if (invitedUsers.find(u => u.isGuest && u.guestName?.toLowerCase() === name.toLowerCase())) return;
		invitedUsers = [...invitedUsers, { 
			id: `guest-${Date.now()}`, // Temporary ID for UI
			guestName: name, 
			isGuest: true 
		}];
		guestNameInput = '';
	}
	
	function removeInvitedUser(userId) {
		invitedUsers = invitedUsers.filter(u => u.id !== userId);
	}
	
	async function respondToInvitation(invitationId, status) {
		try {
			const response = await fetch(`/api/calendar-events/invitations/${invitationId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status })
			});
			
			if (response.ok) {
				const idx = invitations.findIndex(i => i.invitationId === invitationId);
				if (idx !== -1) {
					invitations[idx].status = status;
					invitations = [...invitations];
				}
				showNotification(`Invitation ${status}!`);
				// Reload events to show newly added events
				await loadEventsForRange();
			}
		} catch (error) {
			console.error('Error responding to invitation:', error);
			showNotification('Failed to respond to invitation', 'danger');
		}
	}
	
	async function deleteOrganisedEvent(event) {
		if (!confirm(`Are you sure you want to delete "${event.title}"? This will also remove it from all invited users' calendars.`)) {
			return;
		}
		
		try {
			const response = await fetch('/api/calendar-events/' + event.id, {
				method: 'DELETE'
			});
			
			if (response.ok) {
				organisedEvents = organisedEvents.filter(e => e.id !== event.id);
				showNotification('Event deleted');
				await loadEventsForRange();
			}
		} catch (error) {
			console.error('Error deleting event:', error);
			showNotification('Failed to delete event', 'danger');
		}
	}

	function formatEventDate(dateStr) {
		const date = parseEventDateTimeLocal(dateStr);
		if (!date) return '';
		return date.toLocaleDateString('en-GB', { 
			weekday: 'short', 
			day: 'numeric', 
			month: 'short'
		});
	}
	
	function formatEventTime(dateStr) {
		const date = parseEventDateTimeLocal(dateStr);
		if (!date) return '';
		return date.toLocaleTimeString('en-GB', { 
			hour: '2-digit', 
			minute: '2-digit'
		});
	}

	function getInputDateString(value) {
		if (!value) return '';

		const date = parseEventDateTimeLocal(value);
		if (!date || Number.isNaN(date.getTime())) return '';

		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function getInputTimeString(value) {
		if (!value) return '';

		const date = parseEventDateTimeLocal(value);
		if (!date || Number.isNaN(date.getTime())) return '';

		const h = String(date.getHours()).padStart(2, '0');
		const m = String(date.getMinutes()).padStart(2, '0');
		return `${h}:${m}`;
	}

	function parseEventDateTimeLocal(value) {
		if (!value) return null;

		if (value instanceof Date) {
			return value;
		}

		if (typeof value === 'string') {
			const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
			if (match) {
				const year = Number(match[1]);
				const month = Number(match[2]) - 1;
				const day = Number(match[3]);
				const hour = Number(match[4] || 0);
				const minute = Number(match[5] || 0);
				const second = Number(match[6] || 0);
				return new Date(year, month, day, hour, minute, second);
			}
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return null;
		return date;
	}

	// Week view drag-to-create state
	let isDragging = false;
	let dragStartSlot = null;
	let dragEndSlot = null;
	let dragDay = null;

	// Reactive drag range for visual feedback
	$: dragRange = isDragging && dragStartSlot !== null && dragEndSlot !== null
		? { start: Math.min(dragStartSlot, dragEndSlot), end: Math.max(dragStartSlot, dragEndSlot), day: dragDay }
		: null;

	function toggleMenu(calendarId) {
		openMenuId = openMenuId === calendarId ? null : calendarId;
	}

	function closeMenu() {
		openMenuId = null;
	}

	function handleClickOutside(event) {
		// Close dropdown if clicking outside of it
		if (openMenuId !== null && !event.target.closest('.dropdown')) {
			closeMenu();
		}
	}

	// Load iCal secret on mount for quick access links
	onMount(async () => {
		// Load saved view preference first
		if (typeof window !== 'undefined') {
			const savedViewMode = localStorage.getItem('calendarViewMode');
			if (savedViewMode === 'week' || savedViewMode === 'month') {
				viewMode = savedViewMode;
			}
			viewModeLoaded = true;
		}
		
		try {
			const res = await fetch('/api/calendar-secret');
			if (res.ok) {
				icalSecret = await res.json();
			}
		} catch (err) {
			console.error('Failed to load iCal secret:', err);
		}
		
		// Check if we should show an invitation (from notification click)
		const showInvitationId = $page.url.searchParams.get('showInvitation');
		if (showInvitationId) {
			// Switch to invitations tab and find the matching invitation
			sidebarTab = 'invitations';
			// Clear the URL parameter
			const url = new URL(window.location.href);
			url.searchParams.delete('showInvitation');
			window.history.replaceState({}, '', url);
		}
		
		// Scroll week view to current time on next tick
		setTimeout(() => {
			scrollWeekViewToCurrentTime();
		}, 100);

		// Load user's saved lists for quick invites
		loadUserLists();
	});


	async function loadUserLists() {
		loadingUserLists = true;
		try {
			const res = await fetch('/api/user-lists');
			if (res.ok) {
				userLists = await res.json();
			}
		} catch (err) {
			console.error('Failed to load user lists:', err);
			userLists = [];
		} finally {
			loadingUserLists = false;
		}
	}

	async function selectUserList(listId) {
		selectedUserListId = listId || null;
		selectedListMembers = [];
		if (!listId) return;
		loadingListMembers = true;
		try {
			const res = await fetch(`/api/user-lists/${listId}`);
			if (res.ok) {
				const data = await res.json();
				selectedListMembers = data.members || [];
			}
		} catch (err) {
			console.error('Failed to load list members:', err);
			selectedListMembers = [];
		} finally {
			loadingListMembers = false;
		}
	}

	// Computed calendar data
	$: visibleSharedEvents = sharedEvents
		.filter(e => selectedSharedCalendars.includes(e.sharedCalendarId))
		.map(e => ({
			...e,
			// Give shared events a unique key for the calendar grid
			id: `shared-${e.id}${e.instanceDate ? '-' + e.instanceDate : ''}`,
			originalId: e.id,
			calendarId: `shared-${e.sharedCalendarId}`,
			calendarColour: e.calendarColour,
			calendarName: e.calendarName,
			isShared: true
		}));
	$: visibleEvents = [
		...events.filter(e => selectedCalendars.includes(e.calendarId)),
		...visibleSharedEvents
	];
	$: calendarDays = generateCalendarDays(currentDate);
	$: weekDays = generateWeekDays(currentDate);
	$: timeSlots = generateTimeSlots();
	
	// Save view mode preference and scroll week view when switching to it
	$: if (typeof window !== 'undefined' && viewModeLoaded) {
		localStorage.setItem('calendarViewMode', viewMode);
		if (viewMode === 'week') {
			setTimeout(() => {
				scrollWeekViewToCurrentTime();
			}, 50);
		}
	}

	function generateCalendarDays(date) {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		// Convert Sunday=0 to Monday=0 system: (day + 6) % 7
		const startDay = (firstDay.getDay() + 6) % 7;
		const daysInMonth = lastDay.getDate();

		const days = [];

		// Previous month days
		const prevMonth = new Date(year, month, 0);
		const prevMonthDays = prevMonth.getDate();
		for (let i = startDay - 1; i >= 0; i--) {
			days.push({
				date: new Date(year, month - 1, prevMonthDays - i),
				isCurrentMonth: false
			});
		}

		// Current month days
		for (let i = 1; i <= daysInMonth; i++) {
			days.push({
				date: new Date(year, month, i),
				isCurrentMonth: true
			});
		}

		// Next month days
		const remaining = 42 - days.length; // 6 rows * 7 days
		for (let i = 1; i <= remaining; i++) {
			days.push({
				date: new Date(year, month + 1, i),
				isCurrentMonth: false
			});
		}

		return days;
	}

	function generateWeekDays(date) {
		const days = [];
		const dayOfWeek = date.getDay();
		// Convert to Monday=0 system: Sunday becomes 6, others shift down by 1
		const mondayOffset = (dayOfWeek + 6) % 7;
		const startOfWeek = new Date(date);
		startOfWeek.setDate(date.getDate() - mondayOffset);

		for (let i = 0; i < 7; i++) {
			const d = new Date(startOfWeek);
			d.setDate(startOfWeek.getDate() + i);
			days.push(d);
		}
		return days;
	}

	function generateTimeSlots() {
		const slots = [];
		for (let hour = 0; hour < 24; hour++) {
			slots.push({ hour, minute: 0, label: `${hour.toString().padStart(2, '0')}:00` });
			slots.push({ hour, minute: 30, label: `${hour.toString().padStart(2, '0')}:30` });
		}
		return slots;
	}

	function scrollWeekViewToCurrentTime() {
		if (!weekBodyElement || viewMode !== 'week') return;
		
		const now = new Date();
		const hour = now.getHours();
		const minute = now.getMinutes();
		
		// Each time slot is 25px (hour is 50px with 2 slots per hour)
		// Calculate position: (hours * 50px) + (minutes/60 * 50px) - offset for centering view
		const scrollPosition = (hour * 50) + (minute / 60 * 50) - 150; // 150px offset to center current time
		
		weekBodyElement.scrollTop = Math.max(0, scrollPosition);
	}

	function getEventsForDay(date, events) {
		const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

		return events.filter(event => {
			const eventStart = parseEventDateTimeLocal(event.startDate);
			if (!eventStart) return false;
			return eventStart >= dayStart && eventStart < dayEnd;
		});
	}

	function getEventsForSlot(date, hour, minute, events) {
		return events.filter(event => {
			const eventStart = parseEventDateTimeLocal(event.startDate);
			if (!eventStart) return false;
			const parsedEnd = event.endDate ? parseEventDateTimeLocal(event.endDate) : null;
			const eventEnd = parsedEnd || new Date(eventStart.getTime() + 60 * 60 * 1000);
			
			const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
			const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

			// Event overlaps with this slot
			return eventStart < slotEnd && eventEnd > slotStart;
		});
	}

	function getEventStyle(event, day) {
		const eventStart = parseEventDateTimeLocal(event.startDate);
		if (!eventStart) return `background-color: ${event.calendarColour}; height: 25px; top: 0px;`;
		const parsedEnd = event.endDate ? parseEventDateTimeLocal(event.endDate) : null;
		const eventEnd = parsedEnd || new Date(eventStart.getTime() + 60 * 60 * 1000);
		
		// Calculate duration in minutes
		const durationMs = eventEnd.getTime() - eventStart.getTime();
		const durationMinutes = Math.max(30, durationMs / (1000 * 60)); // Minimum 30 min display
		
		// Each slot is 25px high, so 30 minutes = 25px
		const heightPx = (durationMinutes / 30) * 25;
		
		// Calculate top offset within the starting slot
		const startMinuteInSlot = eventStart.getMinutes() % 30;
		const topOffset = (startMinuteInSlot / 30) * 25;
		
		return `background-color: ${event.calendarColour}; height: ${heightPx}px; top: ${topOffset}px;`;
	}

	function eventStartsInSlot(event, hour, minute) {
		const eventStart = parseEventDateTimeLocal(event.startDate);
		if (!eventStart) return false;
		return eventStart.getHours() === hour && 
			   eventStart.getMinutes() >= minute && 
			   eventStart.getMinutes() < minute + 30;
	}

	function isToday(date) {
		const today = new Date();
		return date.getDate() === today.getDate() &&
			date.getMonth() === today.getMonth() &&
			date.getFullYear() === today.getFullYear();
	}

	function prevPeriod() {
		if (viewMode === 'month') {
			currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
		} else {
			currentDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
		}
		yearInput = String(currentDate.getFullYear());
		loadEventsForRange();
	}

	function nextPeriod() {
		if (viewMode === 'month') {
			currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
		} else {
			currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
		}
		yearInput = String(currentDate.getFullYear());
		loadEventsForRange();
	}

	function goToToday() {
		currentDate = new Date();
		yearInput = String(currentDate.getFullYear());
		loadEventsForRange();
	}

	function setMonth(month) {
		currentDate = new Date(currentDate.getFullYear(), parseInt(month), currentDate.getDate());
		yearInput = String(currentDate.getFullYear());
		loadEventsForRange();
	}

	function setYear(year) {
		const parsedYear = parseInt(year, 10);
		if (Number.isNaN(parsedYear)) {
			yearInput = String(currentDate.getFullYear());
			return;
		}

		currentDate = new Date(parsedYear, currentDate.getMonth(), currentDate.getDate());
		yearInput = String(currentDate.getFullYear());
		loadEventsForRange();
	}

	// Week view drag-to-create
	function handleSlotMouseDown(event, dayIndex, slotIndex) {
		event.preventDefault();
		isDragging = true;
		dragDay = dayIndex;
		dragStartSlot = slotIndex;
		dragEndSlot = slotIndex;
	}

	function handleSlotMouseMove(event, dayIndex, slotIndex) {
		if (isDragging && dayIndex === dragDay) {
			event.preventDefault();
			dragEndSlot = slotIndex;
		}
	}

	function handleSlotMouseUp() {
		if (isDragging && dragStartSlot !== null && dragEndSlot !== null) {
			const startSlotIdx = Math.min(dragStartSlot, dragEndSlot);
			const endSlotIdx = Math.max(dragStartSlot, dragEndSlot);
			
			const startSlot = timeSlots[startSlotIdx];
			const endSlot = timeSlots[endSlotIdx];
			const day = weekDays[dragDay];

			const startTime = `${startSlot.hour.toString().padStart(2, '0')}:${startSlot.minute.toString().padStart(2, '0')}`;
			const endHour = endSlot.minute === 30 ? endSlot.hour + 1 : endSlot.hour;
			const endMinute = endSlot.minute === 30 ? 0 : 30;
			const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

			openNewEventModalWithTime(day, startTime, endTime);
		}
		
		isDragging = false;
		dragStartSlot = null;
		dragEndSlot = null;
		dragDay = null;
	}

	function isSlotInDragRange(dayIndex, slotIndex) {
		if (!dragRange || dragRange.day !== dayIndex) return false;
		return slotIndex >= dragRange.start && slotIndex <= dragRange.end;
	}

	async function loadEventsForRange() {
		let start, end;
		if (viewMode === 'month') {
			start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
			end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
		} else {
			// Convert to Monday=0 system
			const dayOfWeek = (currentDate.getDay() + 6) % 7;
			start = new Date(currentDate);
			start.setDate(currentDate.getDate() - dayOfWeek - 7);
			end = new Date(currentDate);
			end.setDate(currentDate.getDate() + (6 - dayOfWeek) + 7);
		}

		try {
			const [eventsRes, sharedRes] = await Promise.all([
				fetch(`/api/calendar-events?start=${start.toISOString()}&end=${end.toISOString()}`),
				fetch(`/api/shared-calendars`)
			]);
			if (eventsRes.ok) {
				events = await eventsRes.json();
			}
			if (sharedRes.ok) {
				sharedCalendars = await sharedRes.json();
				// Fetch shared events for each calendar
				if (sharedCalendars.length > 0) {
					const sharedEventPromises = sharedCalendars.map(sc =>
						fetch(`/api/shared-calendars/${sc.id}/events?start=${start.toISOString()}&end=${end.toISOString()}`)
							.then(r => r.ok ? r.json() : [])
							.then(events => events.map(e => ({
								...e,
								sharedCalendarId: sc.id,
								calendarColour: sc.colour,
								calendarName: sc.name,
								isShared: true
							})))
					);
					const allSharedEvents = await Promise.all(sharedEventPromises);
					sharedEvents = allSharedEvents.flat();
				} else {
					sharedEvents = [];
				}
				// Add any new shared calendars to selection
				for (const sc of sharedCalendars) {
					if (!selectedSharedCalendars.includes(sc.id)) {
						selectedSharedCalendars = [...selectedSharedCalendars, sc.id];
					}
				}
			}
		} catch (err) {
			console.error('Failed to load events:', err);
		}
	}

	// Check if a calendar requires organise mode
	function calendarRequiresOrganise(calendarId) {
		const calendar = calendars.find(c => c.id === calendarId);
		return calendar && calendar.requireOrganise;
	}

	// Event modal functions
	function openNewEventModal(date = null) {
		showSharedEventModal = false;
		editingEvent = null;
		eventModalTab = 'details'; // Reset tab to details for new events
		const now = date || new Date();
		const defaultCalendar = calendars[0];
		eventForm = {
			calendarId: defaultCalendar?.id || '',
			title: '',
			description: '',
			location: '',
			towerID: null,
			startDate: now.toISOString().slice(0, 10),
			startTime: '09:00',
			endDate: now.toISOString().slice(0, 10),
			endTime: '10:00',
			allDay: false,
			recurrenceType: 'none',
			recurrenceInterval: 1,
			recurrenceEndDate: ''
		};
		// Reset tower and invitation state
		selectedTower = null;
		towerSearch = '';
		towerResults = [];
		invitedUsers = [];
		guestNameInput = '';
		regularEventInvitations = [];
		inviteForm = { invitedUserId: null, guestName: '', instanceDate: null };
		inviteSearchQuery = '';
		inviteSearchResults = [];
		showEventModal = true;
	}

	function openNewEventModalWithTime(date, startTime, endTime) {
		showSharedEventModal = false;
		editingEvent = null;
		eventModalTab = 'details'; // Reset tab to details for new events
		const defaultCalendar = calendars[0];
		eventForm = {
			calendarId: defaultCalendar?.id || '',
			title: '',
			description: '',
			location: '',
			towerID: null,
			startDate: date.toISOString().slice(0, 10),
			startTime: startTime,
			endDate: date.toISOString().slice(0, 10),
			endTime: endTime,
			allDay: false,
			recurrenceType: 'none',
			recurrenceInterval: 1,
			recurrenceEndDate: ''
		};
		// Reset tower and invitation state
		selectedTower = null;
		towerSearch = '';
		towerResults = [];
		invitedUsers = [];
		guestNameInput = '';
		regularEventInvitations = [];
		inviteForm = { invitedUserId: null, guestName: '', instanceDate: null };
		inviteSearchQuery = '';
		inviteSearchResults = [];
		showEventModal = true;
	}

	async function openViewEventModal(event) {
		if (event.isShared) {
			// Open shared event view modal
			viewingSharedEvent = event;
			showViewSharedEventModal = true;
			return;
		}
		viewingEvent = event;
		viewingEventInvitations = [];
		showViewEventModal = true;
		
		// Fetch invitations for this event (for owner or if user is invited)
		// For invited events, sourceEventId points to the original event
		const eventIdToFetch = event.sourceEventId || event.id;
		loadingInvitations = true;
		try {
			const res = await fetch(`/api/calendar-events/${eventIdToFetch}/invitations`);
			if (res.ok) {
				viewingEventInvitations = await res.json();
			}
		} catch (err) {
			console.error('Failed to load invitations:', err);
		} finally {
			loadingInvitations = false;
		}
	}

	function editFromViewModal() {
		showViewEventModal = false;
		openEditEventModal(viewingEvent);
	}

	function editSharedEventFromViewModal() {
		showViewSharedEventModal = false;
		sharedEventModalTab = 'details'; // Start on details tab
		openEditSharedEventModal(viewingSharedEvent);
	}

	function handleSharedRecurrenceEditChoice(scope) {
		showSharedRecurrenceEditModal = false;
		if (pendingSharedRecurrenceEdit) {
			openEditSharedEventModal(pendingSharedRecurrenceEdit, scope);
			pendingSharedRecurrenceEdit = null;
		}
	}

	function cancelSharedRecurrenceEdit() {
		showSharedRecurrenceEditModal = false;
		pendingSharedRecurrenceEdit = null;
	}

	async function deleteSharedEventFromViewModal() {
		if (!viewingSharedEvent) return;
		if (!confirm('Are you sure you want to delete this event?')) return;
		const calId = viewingSharedEvent.sharedCalendarId;
		try {
			const res = await fetch(`/api/shared-calendars/${calId}/events/${viewingSharedEvent.originalId || viewingSharedEvent.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				showViewSharedEventModal = false;
				await loadEventsForRange();
				showNotification('Event deleted');
			}
		} catch (err) {
			showNotification('Failed to delete event', 'danger');
		}
	}

	async function loadEventInvitations() {
		if (!viewingSharedEvent) return;
		loadingEventInvitations = true;
		try {
			const calId = viewingSharedEvent.sharedCalendarId;
			const eventId = viewingSharedEvent.originalId || viewingSharedEvent.id;
			const res = await fetch(`/api/shared-calendars/${calId}/events/${eventId}/invitations`);
			if (res.ok) {
				sharedEventInvitations = await res.json();
			}
		} catch (err) {
			console.error('Failed to load invitations:', err);
			showNotification('Failed to load invitations', 'danger');
		} finally {
			loadingEventInvitations = false;
		}
	}

	async function searchInviteUsers(query) {
		if (!query || query.length < 2) {
			inviteSearchResults = [];
			return;
		}
		
		searchingInvites = true;
		try {
			const res = await fetch(`/api/search-users?q=${encodeURIComponent(query)}`);
			if (res.ok) {
				const results = await res.json();
				// Filter out the current user from results
				inviteSearchResults = results.filter(user => user.id !== data.user.id);
			}
		} catch (err) {
			console.error('Failed to search users:', err);
		} finally {
			searchingInvites = false;
		}
	}

	function selectUserForInvite(user) {
		inviteForm.invitedUserId = user.id;
		inviteSearchQuery = user.username;
		inviteSearchResults = [];
	}

	async function submitInvite() {
		if (!inviteForm.invitedUserId && !inviteForm.guestName.trim()) {
			showNotification('Please select a user or enter a guest name', 'warning');
			return;
		}

		// Don't allow inviting the current user
		if (inviteForm.invitedUserId && inviteForm.invitedUserId === data.user.id) {
			showNotification('You cannot invite yourself to an event', 'warning');
			return;
		}

		// Only allow invitations for single instance edits
		if (editingSharedEvent?.editScope && editingSharedEvent.editScope !== 'single') {
			showNotification('Invitations can only be sent when editing a specific event instance', 'warning');
			return;
		}

		// If invitations are being added from the edit modal (not from view modal)
		if (editingSharedEvent && !viewingSharedEvent) {
			// If event has been saved, send invitation via API
			if (editingSharedEvent.id) {
				try {
					const calId = editingSharedEvent.sharedCalendarId;
					const eventId = editingSharedEvent.originalId || editingSharedEvent.id;
					const res = await fetch(`/api/shared-calendars/${calId}/events/${eventId}/invitations`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							invitedUserId: inviteForm.invitedUserId || null,
							guestName: inviteForm.guestName.trim() || null,
							instanceDate: editingSharedEvent?.instanceDate || null
						})
					});

					if (res.ok) {
						showNotification('Invitation sent');
						inviteForm = { invitedUserId: null, guestName: '', instanceDate: null };
						inviteSearchQuery = '';
						inviteSearchResults = [];
						await loadEventInvitations();
					} else {
						const error = await res.json();
						showNotification(error.message || 'Failed to send invitation', 'danger');
					}
				} catch (err) {
					console.error('Failed to send invitation:', err);
					showNotification('Failed to send invitation', 'danger');
				}
			} else {
				// Event not saved yet, store invitation temporarily
				const newInvite = {
					id: `temp-${Date.now()}-${Math.random()}`,
					invitedUserId: inviteForm.invitedUserId || null,
					invitedUsername: inviteSearchQuery || null,
					guestName: inviteForm.guestName.trim() || null,
					instanceDate: editingSharedEvent?.instanceDate || null,
					status: 'pending',
					isPending: true // Mark as pending (not yet sent)
				};
				sharedEventInvitations = [...sharedEventInvitations, newInvite];
				inviteForm = { invitedUserId: null, guestName: '', instanceDate: null };
				inviteSearchQuery = '';
				inviteSearchResults = [];
				showNotification('Invitation will be sent when event is created');
			}
			return;
		}

		// If invitations are being added from the view modal
		if (!viewingSharedEvent) {
			showNotification('Please select an event', 'warning');
			return;
		}

		try {
			const calId = viewingSharedEvent.sharedCalendarId;
			const eventId = viewingSharedEvent.originalId || viewingSharedEvent.id;
			const res = await fetch(`/api/shared-calendars/${calId}/events/${eventId}/invitations`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					invitedUserId: inviteForm.invitedUserId || null,
					guestName: inviteForm.guestName.trim() || null,
					instanceDate: editingSharedEvent?.instanceDate || null
				})
			});

			if (res.ok) {
				showNotification('Invitation sent');
				showInviteModal = false;
				await loadEventInvitations();
			} else {
				const error = await res.json();
				showNotification(error.message || 'Failed to send invitation', 'danger');
			}
		} catch (err) {
			console.error('Failed to send invitation:', err);
			showNotification('Failed to send invitation', 'danger');
		}
	}

	async function removeInvitation(invitationId) {
		if (!confirm('Remove this invitation?')) return;

		// Handle temporary invitations (not yet sent)
		if (typeof invitationId === 'string' && invitationId.startsWith('temp-')) {
			sharedEventInvitations = sharedEventInvitations.filter(i => i.id !== invitationId);
			showNotification('Invitation removed');
			return;
		}

		// Handle sent invitations
		if (!viewingSharedEvent) return;

		try {
			const calId = viewingSharedEvent.sharedCalendarId;
			const eventId = viewingSharedEvent.originalId || viewingSharedEvent.id;
			const res = await fetch(`/api/shared-calendars/${calId}/events/${eventId}/invitations`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ invitationId })
			});

			if (res.ok) {
				showNotification('Invitation removed');
				await loadEventInvitations();
			} else {
				showNotification('Failed to remove invitation', 'danger');
			}
		} catch (err) {
			console.error('Failed to remove invitation:', err);
			showNotification('Failed to remove invitation', 'danger');
		}
	}

	// Regular event invitations
	async function loadRegularEventInvitations() {
		if (!editingEvent) return;
		loadingEventInvitations = true;
		try {
			const eventId = editingEvent.originalId || editingEvent.id;
			const res = await fetch(`/api/calendar-events/${eventId}/invitations`);
			if (res.ok) {
				regularEventInvitations = await res.json();
			}
		} catch (err) {
			console.error('Failed to load invitations:', err);
			showNotification('Failed to load invitations', 'danger');
		} finally {
			loadingEventInvitations = false;
		}
	}

	async function submitRegularEventInvite() {
		if (!inviteForm.invitedUserId && !inviteForm.guestName.trim()) {
			showNotification('Please select a user or enter a guest name', 'warning');
			return;
		}

			// Only allow invitations for single instance edits
			if (editingEvent?.editScope && editingEvent.editScope !== 'single') {
				showNotification('Invitations can only be sent when editing a specific event instance', 'warning');
				return;
			}

			// If event hasn't been created yet, store invitations temporarily
			if (!editingEvent) {
				const newInvite = {
					id: `temp-${Date.now()}-${Math.random()}`,
					invitedUserId: inviteForm.invitedUserId || null,
					invitedUsername: inviteSearchQuery || null,
					guestName: inviteForm.guestName.trim() || null,
					instanceDate: editingEvent?.instanceDate || null,
					status: 'pending',
					isPending: true // Mark as pending (not yet sent)
				};
				regularEventInvitations = [...regularEventInvitations, newInvite];
				inviteForm = { invitedUserId: null, guestName: '', instanceDate: null };
				inviteSearchQuery = '';
				inviteSearchResults = [];
				showNotification('Invitation will be sent when event is created');
				return;
			}

			try {
				const eventId = editingEvent.originalId || editingEvent.id;
				const res = await fetch(`/api/calendar-events/${eventId}/invitations`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						invitedUserId: inviteForm.invitedUserId || null,
						guestName: inviteForm.guestName.trim() || null,
						instanceDate: editingEvent?.instanceDate || null
					})
				});

				if (res.ok) {
					showNotification('Invitation sent');
					inviteForm = { invitedUserId: null, guestName: '', instanceDate: null };
					inviteSearchQuery = '';
					inviteSearchResults = [];
					await loadRegularEventInvitations();
				} else {
					const error = await res.json();
					showNotification(error.message || 'Failed to send invitation', 'danger');
				}
			} catch (err) {
			console.error('Failed to send invitation:', err);
			showNotification('Failed to send invitation', 'danger');
		}
	}

	async function removeRegularEventInvitation(invitationId) {
		if (!confirm('Remove this invitation?')) return;

		// Handle temporary invitations (not yet sent)
		if (typeof invitationId === 'string' && invitationId.startsWith('temp-')) {
			regularEventInvitations = regularEventInvitations.filter(i => i.id !== invitationId);
			showNotification('Invitation removed');
			return;
		}

		// Handle sent invitations
		if (!editingEvent) return;

		try {
			const eventId = editingEvent.originalId || editingEvent.id;
			const res = await fetch(`/api/calendar-events/${eventId}/invitations`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ invitationId })
			});

			if (res.ok) {
				showNotification('Invitation removed');
				await loadRegularEventInvitations();
			} else {
				showNotification('Failed to remove invitation', 'danger');
			}
		} catch (err) {
			console.error('Failed to remove invitation:', err);
			showNotification('Failed to remove invitation', 'danger');
		}
	}

	async function switchToInvitationsTab() {
		// Allow viewing invitations tab without saving
		eventModalTab = 'invitations';
	}

	async function deleteFromViewModal() {
		if (!viewingEvent || !confirm('Are you sure you want to delete this event?')) return;

		try {
			const res = await fetch(`/api/calendar-events/${viewingEvent.id}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				showViewEventModal = false;
				viewingEvent = null;
				await loadEventsForRange();
				showNotification('Event deleted');
			}
		} catch (err) {
			console.error('Failed to delete event:', err);
			showNotification('Failed to delete event', 'danger');
		}
	}

	async function openEditEventModal(event, editScope = null) {
		showSharedEventModal = false;
		// If this is a recurring event and no scope specified, show the recurrence edit modal
		if (event.recurrenceType && event.recurrenceType !== 'none' && !editScope) {
			pendingRecurrenceEdit = event;
			showRecurrenceEditModal = true;
			return;
		}
		
		editingEvent = { ...event, editScope };
		eventModalTab = 'details'; // Reset tab to details when editing
		const start = new Date(event.startDate);
		const end = event.endDate ? new Date(event.endDate) : start;
		
		eventForm = {
			calendarId: event.calendarId,
			title: event.title,
			description: event.description || '',
			location: event.location || '',
			towerID: event.towerID || null,
			method: event.method || '',
			composition: event.composition || '',
			startDate: getInputDateString(event.startDate),
			startTime: getInputTimeString(event.startDate),
			endDate: getInputDateString(event.endDate || event.startDate),
			endTime: getInputTimeString(event.endDate || event.startDate),
			allDay: event.allDay,
			recurrenceType: event.recurrenceType || 'none',
			recurrenceInterval: event.recurrenceInterval || 1,
			recurrenceEndDate: getInputDateString(event.recurrenceEndDate)
		};
		
		// Set tower if event has one
		if (event.towerID && event.towerPlace) {
			selectedTower = {
				TowerID: event.towerID,
				Place: event.towerPlace,
				Dedicn: event.towerDedication || '',
				County: event.towerCounty || '',
				Bells: event.towerBells || 0
			};
		} else {
			selectedTower = null;
		}
		towerSearch = '';
		towerResults = [];
		invitedUsers = [];
		guestNameInput = '';
		regularEventInvitations = [];
		inviteForm = { invitedUserId: null, guestName: '', instanceDate: null };
		inviteSearchQuery = '';
		inviteSearchResults = [];
		
		showEventModal = true;
		
		// Load existing invitations for editing (only for events user owns)
		if (!event.sourceEventId) {
			try {
				const res = await fetch(`/api/calendar-events/${event.id}/invitations`);
				if (res.ok) {
					const existingInvites = await res.json();
					invitedUsers = existingInvites.map(inv => {
						if (inv.invitedUserId) {
							return {
								id: inv.invitedUserId,
								invitationId: inv.id,
								username: inv.username,
								profileImage: inv.profileImage,
								status: inv.status,
								isGuest: false
							};
						} else {
							return {
								id: `guest-${inv.id}`,
								invitationId: inv.id,
								guestName: inv.guestName,
								status: inv.status,
								isGuest: true
							};
						}
					});
				}
			} catch (err) {
				console.error('Failed to load existing invitations:', err);
			}
		}
	}
	
	function handleRecurrenceEditChoice(scope) {
		showRecurrenceEditModal = false;
		if (pendingRecurrenceEdit) {
			openEditEventModal(pendingRecurrenceEdit, scope);
			pendingRecurrenceEdit = null;
		}
	}
	
	function cancelRecurrenceEdit() {
		showRecurrenceEditModal = false;
		pendingRecurrenceEdit = null;
	}

	async function saveEvent() {
		const isSharedCalendar = typeof eventForm.calendarId === 'string' && eventForm.calendarId.startsWith('shared-');

		const startDateTime = eventForm.allDay 
			? `${eventForm.startDate}T00:00:00`
			: `${eventForm.startDate}T${eventForm.startTime}:00`;
		const endDateTime = eventForm.allDay
			? `${eventForm.endDate}T23:59:59`
			: `${eventForm.endDate}T${eventForm.endTime}:00`;

		if (isSharedCalendar) {
			// Route to shared calendar API
			const sharedCalId = eventForm.calendarId.replace('shared-', '');
			const payload = {
				title: eventForm.title,
				description: eventForm.description,
				location: eventForm.location,
				towerID: eventForm.towerID,
				startDate: startDateTime,
				endDate: endDateTime,
				allDay: eventForm.allDay,
				recurrenceType: eventForm.recurrenceType,
				recurrenceInterval: eventForm.recurrenceInterval,
				recurrenceEndDate: eventForm.recurrenceEndDate || null
			};

			try {
				const res = await fetch(`/api/shared-calendars/${sharedCalId}/events`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});

				if (res.ok) {
					showEventModal = false;
					await loadEventsForRange();
					showNotification('Event created in shared calendar!');
				} else {
					const err = await res.json();
					showNotification(err.message || 'Failed to save event', 'danger');
				}
			} catch (err) {
				console.error('Failed to save shared event:', err);
				showNotification('Failed to save event', 'danger');
			}
			return;
		}

		const payload = {
			calendarId: parseInt(eventForm.calendarId),
			title: eventForm.title,
			description: eventForm.description,
			location: eventForm.location,
			towerID: eventForm.towerID,
			method: eventForm.method || null,
			composition: eventForm.composition || null,
			startDate: startDateTime,
			endDate: endDateTime,
			allDay: eventForm.allDay,
			recurrenceType: eventForm.recurrenceType,
			recurrenceInterval: eventForm.recurrenceInterval,
			recurrenceEndDate: eventForm.recurrenceEndDate || null,
			invitedUsers: invitedUsers.filter(u => !u.isGuest).map(u => u.id),
			guestInvites: invitedUsers.filter(u => u.isGuest).map(u => u.guestName),
			editScope: editingEvent?.editScope || null, // 'single', 'future', or 'all'
			originalStartDate: editingEvent?.startDate || null // For identifying which occurrence
		};

		try {
			let res;
			if (editingEvent) {
				res = await fetch(`/api/calendar-events/${editingEvent.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			} else {
				res = await fetch('/api/calendar-events', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			}

			if (res.ok) {
				const resultData = await res.json();
				// If new event created, send pending invitations
				if (!editingEvent && resultData.id) {
					const pendingInvites = regularEventInvitations.filter(inv => inv.isPending);
					if (pendingInvites.length > 0) {
						for (const invite of pendingInvites) {
							try {
								await fetch(`/api/calendar-events/${resultData.id}/invitations`, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										invitedUserId: invite.invitedUserId || null,
										guestName: invite.guestName || null,
										instanceDate: invite.instanceDate || null
									})
								});
							} catch (err) {
								console.error('Failed to send invitation:', err);
							}
						}
					}
				}

				showEventModal = false;
				await loadEventsForRange();
				// Reload organised events
				const organised = await fetch('/api/calendar-events/organised');
				if (organised.ok) {
					organisedEvents = await organised.json();
				}
			} else {
				const err = await res.json();
				showNotification(err.message || 'Failed to save event', 'danger');
			}
		} catch (err) {
			console.error('Failed to save event:', err);
			showNotification('Failed to save event', 'danger');
		}
	}

	async function deleteEvent() {
		if (!editingEvent || !confirm('Are you sure you want to delete this event?')) return;

		try {
			const res = await fetch(`/api/calendar-events/${editingEvent.id}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				showEventModal = false;
				await loadEventsForRange();
			}
		} catch (err) {
			console.error('Failed to delete event:', err);
		}
	}

	// Calendar modal functions
	function openNewCalendarModal() {
		editingCalendar = null;
		calendarForm = { name: '', colour: '#3788d8' };
		showCalendarModal = true;
	}

	async function openEditCalendarModal(calendar) {
		editingCalendar = calendar;
		calendarForm = { name: calendar.name, colour: calendar.colour };
		showCalendarModal = true;

		// Load iCal secret for the link
		if (!icalSecret) {
			try {
				const res = await fetch('/api/calendar-secret');
				if (res.ok) {
					icalSecret = await res.json();
				}
			} catch (err) {
				console.error('Failed to load iCal secret:', err);
			}
		}
	}

	async function saveCalendar() {
		try {
			let res;
			if (editingCalendar) {
				res = await fetch(`/api/calendars/${editingCalendar.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(calendarForm)
				});
			} else {
				res = await fetch('/api/calendars', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(calendarForm)
				});
			}

			if (res.ok) {
				showCalendarModal = false;
				// Refresh calendars
				const calRes = await fetch('/api/calendars');
				if (calRes.ok) {
					calendars = await calRes.json();
					selectedCalendars = calendars.map(c => c.id);
				}
			} else {
				const err = await res.json();
				showNotification(err.message || 'Failed to save calendar', 'danger');
			}
		} catch (err) {
			console.error('Failed to save calendar:', err);
		}
	}

	async function deleteCalendar() {
		if (!editingCalendar || editingCalendar.isPreset) return;
		if (!confirm(`Are you sure you want to delete "${editingCalendar.name}"? All events in this calendar will be deleted.`)) return;

		try {
			const res = await fetch(`/api/calendars/${editingCalendar.id}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				showCalendarModal = false;
				const calRes = await fetch('/api/calendars');
				if (calRes.ok) {
					calendars = await calRes.json();
					selectedCalendars = calendars.map(c => c.id);
				}
				await loadEventsForRange();
			}
		} catch (err) {
			console.error('Failed to delete calendar:', err);
		}
	}

	// Settings modal functions
	async function openSettingsModal() {
		showSettingsModal = true;
		loadingSecret = true;

		try {
			const res = await fetch('/api/calendar-secret');
			if (res.ok) {
				icalSecret = await res.json();
			}
		} catch (err) {
			console.error('Failed to load iCal secret:', err);
		} finally {
			loadingSecret = false;
		}
	}

	async function regenerateSecret() {
		if (!confirm('Regenerating your secret link will invalidate any existing subscriptions. Continue?')) return;

		loadingSecret = true;
		try {
			const res = await fetch('/api/calendar-secret', { method: 'POST' });
			if (res.ok) {
				icalSecret = await res.json();
			}
		} catch (err) {
			console.error('Failed to regenerate secret:', err);
		} finally {
			loadingSecret = false;
		}
	}

	function copyICalLink() {
		if (!icalSecret) return;
		const url = `${window.location.origin}/ical/${icalSecret.secretKey}`;
		navigator.clipboard.writeText(url);
		showNotification('iCal link copied to clipboard!');
	}

	function copyCalendarICalLink(calendarId) {
		if (!icalSecret) return;
		const url = `${window.location.origin}/ical/${icalSecret.secretKey}/${calendarId}`;
		navigator.clipboard.writeText(url);
		showNotification('Calendar iCal link copied to clipboard!');
	}

	function toggleCalendar(calendarId) {
		if (selectedCalendars.includes(calendarId)) {
			selectedCalendars = selectedCalendars.filter(id => id !== calendarId);
		} else {
			selectedCalendars = [...selectedCalendars, calendarId];
		}
	}

	function toggleSharedCalendar(calendarId) {
		if (selectedSharedCalendars.includes(calendarId)) {
			selectedSharedCalendars = selectedSharedCalendars.filter(id => id !== calendarId);
		} else {
			selectedSharedCalendars = [...selectedSharedCalendars, calendarId];
		}
	}

	// Shared calendar CRUD functions
	function openNewSharedCalendarModal() {
		sharedCalendarForm = { name: '', colour: '#3788d8' };
		showSharedCalendarModal = true;
	}

	async function saveSharedCalendar() {
		if (!sharedCalendarForm.name.trim()) {
			showNotification('Please enter a calendar name', 'warning');
			return;
		}
		savingSharedCalendar = true;
		try {
			const res = await fetch('/api/shared-calendars', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(sharedCalendarForm)
			});
			if (res.ok) {
				const newCal = await res.json();
				sharedCalendars = [...sharedCalendars, newCal];
				selectedSharedCalendars = [...selectedSharedCalendars, newCal.id];
				showSharedCalendarModal = false;
				showNotification('Shared calendar created!');
			} else {
				const err = await res.json();
				showNotification(err.message || 'Failed to create shared calendar', 'danger');
			}
		} catch (err) {
			console.error('Failed to create shared calendar:', err);
			showNotification('Failed to create shared calendar', 'danger');
		} finally {
			savingSharedCalendar = false;
		}
	}

	async function openManageSharedCalendar(calendar) {
		managingSharedCalendar = calendar;
		sharedCalendarForm = { name: calendar.name, colour: calendar.colour };
		sharedCalendarMembers = [];
		transferTargetUserId = null;
		loadingSharedMembers = true;
		showManageSharedCalendarModal = true;

		try {
			const res = await fetch(`/api/shared-calendars/${calendar.id}/members`);
			if (res.ok) {
				sharedCalendarMembers = await res.json();
			}
		} catch (err) {
			console.error('Failed to load members:', err);
		} finally {
			loadingSharedMembers = false;
		}
	}

	async function updateSharedCalendar() {
		if (!managingSharedCalendar) return;
		try {
			const res = await fetch(`/api/shared-calendars/${managingSharedCalendar.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(sharedCalendarForm)
			});
			if (res.ok) {
				const idx = sharedCalendars.findIndex(c => c.id === managingSharedCalendar.id);
				if (idx !== -1) {
					sharedCalendars[idx] = { ...sharedCalendars[idx], ...sharedCalendarForm };
					sharedCalendars = [...sharedCalendars];
				}
				managingSharedCalendar = { ...managingSharedCalendar, ...sharedCalendarForm };
				showNotification('Calendar updated!');
			} else {
				const err = await res.json();
				showNotification(err.message || 'Failed to update', 'danger');
			}
		} catch (err) {
			showNotification('Failed to update calendar', 'danger');
		}
	}

	async function addSharedCalendarMember(user) {
		if (!managingSharedCalendar) return;
		try {
			const res = await fetch(`/api/shared-calendars/${managingSharedCalendar.id}/members`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: user.id, role: 'viewer' })
			});
			if (res.ok) {
				const member = await res.json();
				sharedCalendarMembers = [...sharedCalendarMembers, { ...member, username: user.username, profileImage: user.profileImage }];
				showNotification(`${user.username} added as viewer!`);
			} else {
				const err = await res.json();
				showNotification(err.message || 'Failed to add member', 'danger');
			}
		} catch (err) {
			showNotification('Failed to add member', 'danger');
		}
	}

	async function updateSharedCalendarMemberRole(userId, newRole) {
		if (!managingSharedCalendar) return;
		const member = sharedCalendarMembers.find(m => m.userId === userId);
		if (!member || member.role === newRole) return;
		try {
			const res = await fetch(`/api/shared-calendars/${managingSharedCalendar.id}/members`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, role: newRole })
			});
			if (res.ok) {
				const memberIdx = sharedCalendarMembers.findIndex(m => m.userId === userId);
				if (memberIdx !== -1) {
					sharedCalendarMembers[memberIdx].role = newRole;
					sharedCalendarMembers = [...sharedCalendarMembers];
				}
				const roleLabel = newRole === 'editor' ? 'editor' : 'viewer';
				showNotification(`${member.username} is now a ${roleLabel}!`);
			} else {
				const err = await res.json();
				showNotification(err.message || 'Failed to update member role', 'danger');
			}
		} catch (err) {
			showNotification('Failed to update member role', 'danger');
		}
	}

	async function removeSharedCalendarMember(userId) {
		if (!managingSharedCalendar) return;
		const member = sharedCalendarMembers.find(m => m.userId === userId);
		if (!confirm(`Remove ${member?.username || 'this user'} from the calendar?`)) return;
		try {
			const res = await fetch(`/api/shared-calendars/${managingSharedCalendar.id}/members`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId })
			});
			if (res.ok) {
				sharedCalendarMembers = sharedCalendarMembers.filter(m => m.userId !== userId);
				showNotification('Member removed');
			} else {
				const err = await res.json();
				showNotification(err.message || 'Failed to remove member', 'danger');
			}
		} catch (err) {
			showNotification('Failed to remove member', 'danger');
		}
	}

	async function transferSharedCalendarOwnership() {
		if (!managingSharedCalendar || !transferTargetUserId) return;
		const targetMember = sharedCalendarMembers.find(m => m.userId === transferTargetUserId);
		if (!confirm(`Transfer ownership of "${managingSharedCalendar.name}" to ${targetMember?.username}? You will become an editor.`)) return;
		try {
			const res = await fetch(`/api/shared-calendars/${managingSharedCalendar.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'transfer', newOwnerId: transferTargetUserId })
			});
			if (res.ok) {
				showManageSharedCalendarModal = false;
				showNotification('Ownership transferred!');
				await loadEventsForRange();
			} else {
				const err = await res.json();
				showNotification(err.message || 'Failed to transfer', 'danger');
			}
		} catch (err) {
			showNotification('Failed to transfer ownership', 'danger');
		}
	}

	async function regenerateSharedCalendarSecret() {
		if (!managingSharedCalendar) return;
		if (!confirm('Regenerating the iCal link will invalidate any existing subscriptions. Continue?')) return;
		try {
			const res = await fetch(`/api/shared-calendars/${managingSharedCalendar.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'regenerate_secret' })
			});
			if (res.ok) {
				const data = await res.json();
				managingSharedCalendar = { ...managingSharedCalendar, secretKey: data.secretKey };
				// Update in list too
				const idx = sharedCalendars.findIndex(c => c.id === managingSharedCalendar.id);
				if (idx !== -1) {
					sharedCalendars[idx] = { ...sharedCalendars[idx], secretKey: data.secretKey };
					sharedCalendars = [...sharedCalendars];
				}
				showNotification('iCal link regenerated!');
			}
		} catch (err) {
			showNotification('Failed to regenerate link', 'danger');
		}
	}

	function copySharedCalendarICalLink(calendar) {
		if (!calendar.secretKey) {
			showNotification('Only the owner can see the iCal link', 'warning');
			return;
		}
		const url = `${window.location.origin}/ical/shared/${calendar.secretKey}`;
		navigator.clipboard.writeText(url);
		showNotification('Shared calendar iCal link copied!');
	}

	async function deleteSharedCalendar() {
		if (!managingSharedCalendar) return;
		if (!confirm(`Are you sure you want to delete "${managingSharedCalendar.name}"? All events in this calendar will be deleted.`)) return;
		try {
			const res = await fetch(`/api/shared-calendars/${managingSharedCalendar.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				sharedCalendars = sharedCalendars.filter(c => c.id !== managingSharedCalendar.id);
				selectedSharedCalendars = selectedSharedCalendars.filter(id => id !== managingSharedCalendar.id);
				showManageSharedCalendarModal = false;
				showNotification('Shared calendar deleted');
				await loadEventsForRange();
			}
		} catch (err) {
			showNotification('Failed to delete calendar', 'danger');
		}
	}

	async function leaveSharedCalendar(calendar) {
		if (!confirm(`Leave "${calendar.name}"? You will no longer see events from this calendar.`)) return;
		try {
			const res = await fetch(`/api/shared-calendars/${calendar.id}/members`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: data.user.id })
			});
			if (res.ok) {
				sharedCalendars = sharedCalendars.filter(c => c.id !== calendar.id);
				selectedSharedCalendars = selectedSharedCalendars.filter(id => id !== calendar.id);
				showManageSharedCalendarModal = false;
				showNotification('Left shared calendar');
				await loadEventsForRange();
			}
		} catch (err) {
			showNotification('Failed to leave calendar', 'danger');
		}
	}

	// Shared calendar event functions
	let sharedEventForm = {
		sharedCalendarId: '',
		title: '',
		description: '',
		location: '',
		locationCustom: false,
		towerID: null,
		method: '',
		composition: '',
		startDate: '',
		startTime: '',
		endDate: '',
		endTime: '',
		allDay: false,
		recurrenceType: 'none',
		recurrenceInterval: 1,
		recurrenceEndDate: '',
		invitees: []
	};
	let editingSharedEvent = null;
	let showSharedEventModal = false;

	function openNewSharedEventModal(sharedCalendarId, date = null) {
		showEventModal = false;
		editingSharedEvent = null;
		sharedEventModalTab = 'details'; // Reset tab to details for new events
		const now = date || new Date();
		sharedEventForm = {
			sharedCalendarId: sharedCalendarId,
			title: '',
			description: '',
			location: '',
			locationCustom: false,
			towerID: null,
			method: '',
			composition: '',
			startDate: now.toISOString().slice(0, 10),
			startTime: '09:00',
			endDate: now.toISOString().slice(0, 10),
			endTime: '10:00',
			allDay: false,
			recurrenceType: 'none',
			recurrenceInterval: 1,
			recurrenceEndDate: '',
			invitees: []
		};
		selectedTower = null;
		towerSearch = '';
		towerResults = [];
		showSharedEventModal = true;
	}

	async function openEditSharedEventModal(event, editScope = null) {
		showEventModal = false;
		// If this is a recurring event and no scope specified, show the recurrence edit modal
		if (event.recurrenceType && event.recurrenceType !== 'none' && !editScope) {
			pendingSharedRecurrenceEdit = event;
			showSharedRecurrenceEditModal = true;
			return;
		}
		
		editingSharedEvent = { ...event, editScope };
		sharedEventModalTab = 'details'; // Reset to details tab
		const start = new Date(event.startDate);
		const end = event.endDate ? new Date(event.endDate) : start;
		sharedEventForm = {
			sharedCalendarId: event.sharedCalendarId,
			title: event.title,
			description: event.description || '',
			location: event.location || '',
			locationCustom: !event.towerID,
			towerID: event.towerID || null,
			method: event.method || '',
			composition: event.composition || '',
			startDate: getInputDateString(event.startDate),
			startTime: getInputTimeString(event.startDate),
			endDate: getInputDateString(event.endDate || event.startDate),
			endTime: getInputTimeString(event.endDate || event.startDate),
			allDay: event.allDay,
			recurrenceType: event.recurrenceType || 'none',
			recurrenceInterval: event.recurrenceInterval || 1,
			recurrenceEndDate: getInputDateString(event.recurrenceEndDate),
			invitees: [],
			editScope: editScope
		};
		if (event.towerID && event.towerPlace) {
			selectedTower = { TowerID: event.towerID, Place: event.towerPlace, Dedicn: event.towerDedication || '' };
		} else {
			selectedTower = null;
		}
		towerSearch = '';
		towerResults = [];
		inviteForm = { invitedUserId: null, guestName: '', instanceDate: null };
		inviteSearchQuery = '';
		inviteSearchResults = [];
		sharedEventInvitations = [];
		showSharedEventModal = true;

		// Load existing invitations for this event
		try {
			const calId = event.sharedCalendarId;
			const eventId = event.originalId || event.id;
			const res = await fetch(`/api/shared-calendars/${calId}/events/${eventId}/invitations`);
			if (res.ok) {
				sharedEventInvitations = await res.json();
			}
		} catch (err) {
			console.error('Failed to load invitations:', err);
		}
	}

	async function saveSharedEvent() {
		const calId = sharedEventForm.sharedCalendarId;
		const startDateTime = sharedEventForm.allDay
			? `${sharedEventForm.startDate}T00:00:00`
			: `${sharedEventForm.startDate}T${sharedEventForm.startTime}:00`;
		const endDateTime = sharedEventForm.allDay
			? `${sharedEventForm.endDate}T23:59:59`
			: `${sharedEventForm.endDate}T${sharedEventForm.endTime}:00`;

		const payload = {
			title: sharedEventForm.title,
			description: sharedEventForm.description,
			location: sharedEventForm.location,
			towerID: sharedEventForm.towerID,
			method: sharedEventForm.method || null,
			composition: sharedEventForm.composition || null,
			startDate: startDateTime,
			endDate: endDateTime,
			allDay: sharedEventForm.allDay,
			recurrenceType: sharedEventForm.recurrenceType,
			recurrenceInterval: sharedEventForm.recurrenceInterval,
			recurrenceEndDate: sharedEventForm.recurrenceEndDate || null,
			editScope: sharedEventForm.editScope || null, // 'single', 'future', or 'all'
			originalStartDate: editingSharedEvent?.startDate || null // For identifying which occurrence
		};

		try {
			let res;
			if (editingSharedEvent) {
				res = await fetch(`/api/shared-calendars/${calId}/events/${editingSharedEvent.originalId || editingSharedEvent.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			} else {
				res = await fetch(`/api/shared-calendars/${calId}/events`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			}

			if (res.ok) {
				const resultData = await res.json();
				// If new event created, send pending invitations
				if (!editingSharedEvent && resultData.id) {
					const pendingInvites = sharedEventInvitations.filter(inv => inv.isPending);
					if (pendingInvites.length > 0) {
						for (const invite of pendingInvites) {
							try {
								await fetch(`/api/shared-calendars/${calId}/events/${resultData.id}/invitations`, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										invitedUserId: invite.invitedUserId || null,
										guestName: invite.guestName || null,
										instanceDate: invite.instanceDate || null
									})
								});
							} catch (err) {
								console.error('Failed to send invitation:', err);
							}
						}
					}
				}

				showSharedEventModal = false;
				await loadEventsForRange();
				showNotification(editingSharedEvent ? 'Event updated!' : 'Event created!');
			} else {
				const err = await res.json();
				showNotification(err.message || 'Failed to save event', 'danger');
			}
		} catch (err) {
			showNotification('Failed to save event', 'danger');
		}
	}

	async function deleteSharedEvent() {
		if (!editingSharedEvent) return;
		if (!confirm('Are you sure you want to delete this event?')) return;
		const calId = sharedEventForm.sharedCalendarId;
		try {
			const res = await fetch(`/api/shared-calendars/${calId}/events/${editingSharedEvent.originalId || editingSharedEvent.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				showSharedEventModal = false;
				await loadEventsForRange();
				showNotification('Event deleted');
			}
		} catch (err) {
			showNotification('Failed to delete event', 'danger');
		}
	}

	async function switchToSharedEventInvitationsTab() {
		// Function removed - invitations now inline with details tab
	}

	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
		'July', 'August', 'September', 'October', 'November', 'December'];
	const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
</script>

<svelte:window on:click={handleClickOutside} />

<svelte:head>
	<title>Calendar | towertrack</title>
	<meta name="description" content="Manage your bell ringing schedule and events" />
	<link rel="stylesheet" href="/assets/css/calendar.css">
</svelte:head>

<Header user={data.user} />

{#if notification}
	<div class="notification-toast notification is-{notification.type}" role="alert">
		<button class="delete" aria-label="Close notification" on:click={() => notification = null}></button>
		{notification.message}
	</div>
{/if}

<main class="section">
	<div class="container">
		<h1 class="title is-2">Calendar</h1>
		<div class="columns">
			<!-- Sidebar -->
			<div class="column is-3">
				<div class="box">
					<button class="button is-primary is-fullwidth mb-4" on:click={() => openNewEventModal()}>
						<span>+ New Event</span>
					</button>

					<!-- Sidebar Tabs -->
					<div class="tabs is-small is-boxed mb-3">
						<ul>
							<li class:is-active={sidebarTab === 'calendars'}>
								<a href="#calendars" on:click|preventDefault={() => sidebarTab = 'calendars'}>Calendars</a>
							</li>
							<li class:is-active={sidebarTab === 'myEvents'}>
								<a href="#myEvents" on:click|preventDefault={() => sidebarTab = 'myEvents'}>
									My Events
									{#if organisedEvents.length > 0}
										<span class="tag is-small is-primary ml-1">{organisedEvents.length}</span>
									{/if}
								</a>
							</li>
							<li class:is-active={sidebarTab === 'invitations'}>
								<a href="#invitations" on:click|preventDefault={() => sidebarTab = 'invitations'}>
									Invitations
									{#if invitations.filter(i => i.status === 'pending').length > 0}
										<span class="tag is-small ml-1">{invitations.filter(i => i.status === 'pending').length}</span>
									{/if}
								</a>
							</li>
						</ul>
					</div>

					<!-- Calendars Tab Content -->
					{#if sidebarTab === 'calendars'}
						<h3 class="title is-6 mb-3">My Calendars</h3>
						
						{#each calendars as calendar}
							<div class="calendar-item mb-2">
								<div class="is-flex is-align-items-center">
									<label class="checkbox is-flex is-align-items-center" style="flex: 1;">
										<input 
											type="checkbox" 
											checked={selectedCalendars.includes(calendar.id)}
											on:change={() => toggleCalendar(calendar.id)}
										/>
										<span 
											class="calendar-colour-dot ml-2" 
											style="background-color: {calendar.colour}"
										></span>
										<span class="ml-2">{calendar.name}</span>
									</label>
									<div class="dropdown is-right" class:is-active={openMenuId === calendar.id}>
										<div class="dropdown-trigger">
											<button 
												class="button is-small is-ghost"
												on:click|stopPropagation={() => toggleMenu(calendar.id)}
												aria-haspopup="true"
												aria-label="Calendar options"
											>
												<span class="icon is-small">⋮</span>
											</button>
										</div>
										<div class="dropdown-menu" role="menu">
											<div class="dropdown-content">
												{#if icalSecret}
													<button class="dropdown-item" type="button" on:click={() => { copyCalendarICalLink(calendar.id); closeMenu(); }}>
														<span>Copy iCal Link</span>
													</button>
													<hr class="dropdown-divider" />
												{/if}
												<button class="dropdown-item" type="button" on:click={() => { openEditCalendarModal(calendar); closeMenu(); }}>
													<span>Edit</span>
												</button>
												{#if !calendar.isPreset}
													<hr class="dropdown-divider" />
													<button class="dropdown-item has-text-danger" type="button" on:click={() => { editingCalendar = calendar; deleteCalendar(); closeMenu(); }}>
														<span>Delete</span>
													</button>
												{/if}
											</div>
										</div>
									</div>
								</div>
							</div>
						{/each}

						<button class="button is-small is-ghost mt-3" on:click={openNewCalendarModal}>
							<span>+ Add Calendar</span>
						</button>

						<hr />

						<!-- Shared Calendars -->
						<h3 class="title is-6 mb-3">Shared Calendars</h3>

						{#if sharedCalendars.length === 0}
							<p class="has-text-grey is-size-7 mb-2">No shared calendars yet.</p>
						{:else}
							{#each sharedCalendars as calendar}
								<div class="calendar-item mb-2">
									<div class="is-flex is-align-items-center">
										<label class="checkbox is-flex is-align-items-center" style="flex: 1;">
											<input 
												type="checkbox" 
												checked={selectedSharedCalendars.includes(calendar.id)}
												on:change={() => toggleSharedCalendar(calendar.id)}
											/>
											<span 
												class="calendar-colour-dot ml-2" 
												style="background-color: {calendar.colour}"
											></span>
											<span class="ml-2">
												{calendar.name}
												{#if calendar.role !== 'owner'}
													<span class="is-size-7 has-text-grey">({calendar.ownerUsername})</span>
												{/if}
											</span>
										</label>
										<div class="dropdown is-right" class:is-active={openMenuId === `shared-${calendar.id}`}>
											<div class="dropdown-trigger">
												<button 
													class="button is-small is-ghost"
													on:click|stopPropagation={() => toggleMenu(`shared-${calendar.id}`)}
													aria-haspopup="true"
													aria-label="Shared calendar options"
												>
													<span class="icon is-small">⋮</span>
												</button>
											</div>
											<div class="dropdown-menu" role="menu">
												<div class="dropdown-content">
													{#if calendar.role === 'owner' && calendar.secretKey}
														<button class="dropdown-item" type="button" on:click={() => { copySharedCalendarICalLink(calendar); closeMenu(); }}>
															<span>Copy iCal Link</span>
														</button>
														<hr class="dropdown-divider" />
													{/if}
													<button class="dropdown-item" type="button" on:click={() => { openManageSharedCalendar(calendar); closeMenu(); }}>
														<span>{calendar.role === 'owner' ? 'Manage' : 'Details'}</span>
													</button>
													{#if calendar.role !== 'owner'}
														<hr class="dropdown-divider" />
														<button class="dropdown-item has-text-danger" type="button" on:click={() => { leaveSharedCalendar(calendar); closeMenu(); }}>
															<span>Leave</span>
														</button>
													{/if}
													{#if calendar.role === 'owner'}
														<hr class="dropdown-divider" />
														<button class="dropdown-item has-text-danger" type="button" on:click={() => { openManageSharedCalendar(calendar); closeMenu(); }}>
															<span>Delete</span>
														</button>
													{/if}
												</div>
											</div>
										</div>
									</div>
								</div>
							{/each}
						{/if}

						<button class="button is-small is-ghost mt-3" on:click={openNewSharedCalendarModal}>
							<span>+ Add Shared Calendar</span>
						</button>

						<hr />

						<button class="button is-small is-ghost" on:click={openSettingsModal}>
							<span>⚙ Calendar Settings</span>
						</button>
					{/if}

					<!-- My Events Tab Content -->
					{#if sidebarTab === 'myEvents'}
						<h3 class="title is-6 mb-3">Events I'm Organising</h3>
						
						{#if organisedEvents.length === 0}
							<p class="has-text-grey is-size-7">No organised events yet. Create an event and invite others!</p>
						{:else}
							{#each organisedEvents as event}
								<div class="organised-event-item mb-3 p-2" style="border-left: 3px solid {event.calendarColour || '#3788d8'};">
									<div class="is-flex is-justify-content-space-between is-align-items-start">
										<div style="flex: 1;">
											<p class="has-text-weight-medium is-size-7 mb-1">{event.title}</p>
											<p class="is-size-7 has-text-grey">{formatEventDate(event.startDate)}</p>
											{#if event.towerPlace}
												<p class="is-size-7 has-text-grey">{event.towerPlace}</p>
											{/if}
											{#if event.invitationCount > 0}
												<p class="is-size-7">
													<span class="tag is-small is-light">{event.invitationCount} invited</span>
												</p>
											{/if}
										</div>
										<div class="buttons are-small">
											<button class="button is-small is-ghost" on:click={() => openEditEventModal(event)} title="Edit">
												✏
											</button>
											<button class="button is-small is-ghost has-text-danger" on:click={() => deleteOrganisedEvent(event)} title="Delete">
												🗑
											</button>
										</div>
									</div>
								</div>
							{/each}
						{/if}
					{/if}

					<!-- Invitations Tab Content -->
					{#if sidebarTab === 'invitations'}
						<h3 class="title is-6 mb-3">Event Invitations</h3>
						
						{#if invitations.length === 0}
							<p class="is-size-7">No invitations.</p>
						{:else}
							{#each invitations as invitation}
								<div class="invitation-item mb-3 p-2" style="border-left: 3px solid {invitation.status === 'pending' ? '#ffdd57' : invitation.status === 'accepted' ? '#48c774' : invitation.status === 'declined' ? '#f14668' : '#3e8ed0'};">
									<p class="has-text-weight-medium is-size-7 mb-1">{invitation.title}</p>
									<p class="is-size-7 has-text-grey">{formatEventDate(invitation.startDate)}</p>
									{#if invitation.towerPlace}
										<p class="is-size-7 has-text-grey">{invitation.towerPlace}</p>
									{/if}
									<p class="is-size-7 has-text-grey mb-2">From: {invitation.organiserUsername}</p>
									
									<div class="buttons are-small">
										<button 
											class="button is-small" 
											class:is-success={invitation.status === 'accepted'}
											class:is-outlined={invitation.status !== 'accepted'}
											on:click={() => respondToInvitation(invitation.invitationId, 'accepted')}
										>
											Accept
										</button>
										<button 
											class="button is-small" 
											class:is-info={invitation.status === 'maybe'}
											class:is-outlined={invitation.status !== 'maybe'}
											on:click={() => respondToInvitation(invitation.invitationId, 'maybe')}
										>
											Maybe
										</button>
										<button 
											class="button is-small" 
											class:is-danger={invitation.status === 'declined'}
											class:is-outlined={invitation.status !== 'declined'}
											on:click={() => respondToInvitation(invitation.invitationId, 'declined')}
										>
											Decline
										</button>
									</div>
								</div>
							{/each}
						{/if}
					{/if}
				</div>
			</div>

			<!-- Calendar -->
			<div class="column is-9">
				<div class="box">
					<!-- Calendar header -->
					<div class="level mb-4">
						<div class="level-left">
							<div class="level-item">
								<button class="button is-small" on:click={prevPeriod} aria-label="Previous">
									<span>‹</span>
								</button>
							</div>
							<div class="level-item">
								<button class="button is-small" on:click={nextPeriod} aria-label="Next">
									<span>›</span>
								</button>
							</div>
							<div class="level-item">
								<button class="button is-small" on:click={goToToday}>Today</button>
							</div>
							<div class="level-item">
								<div class="select is-small">
									<select value={currentDate.getMonth()} on:change={(e) => setMonth(e.target.value)}>
										{#each monthNames as month, i}
											<option value={i}>{month}</option>
										{/each}
									</select>
								</div>
							</div>
							<div class="level-item">
								<div class="control">
									<input
										class="input is-small"
										type="text"
										inputmode="numeric"
										pattern="[0-9]*"
										aria-label="Calendar year"
										bind:value={yearInput}
										on:change={() => setYear(yearInput)}
										on:keydown={(e) => e.key === 'Enter' && setYear(yearInput)}
									/>
								</div>
							</div>
						</div>
						<div class="level-right">
							<div class="level-item">
								<div class="buttons has-addons">
									<button 
										class="button is-small" 
										class:is-primary={viewMode === 'month'}
										on:click={() => { viewMode = 'month'; loadEventsForRange(); }}
									>
										Month
									</button>
									<button 
										class="button is-small" 
										class:is-primary={viewMode === 'week'}
										on:click={() => { viewMode = 'week'; loadEventsForRange(); }}
									>
										Week
									</button>
								</div>
							</div>
						</div>
					</div>

					{#if viewMode === 'month'}
						<!-- Month view grid -->
						<div class="calendar-grid">
							<!-- Day headers -->
							{#each dayNames as day}
								<div class="calendar-header">{day}</div>
							{/each}

							<!-- Days -->
							{#each calendarDays as day}
								<div 
									class="calendar-day" 
									class:is-other-month={!day.isCurrentMonth}
									class:is-today={isToday(day.date)}
									on:click={() => openNewEventModal(day.date)}
									on:keydown={(e) => e.key === 'Enter' && openNewEventModal(day.date)}
									tabindex="0"
									role="button"
								>
									<span class="day-number">{day.date.getDate()}</span>
									<div class="day-events">
										{#each getEventsForDay(day.date, visibleEvents).slice(0, 3) as event (event.id)}
											<div 
												class="event-chip" 
												class:is-tentative={event.status === 'tentative'}
												style="background-color: {event.calendarColour}"
												on:click|stopPropagation={() => openViewEventModal(event)}
												on:keydown|stopPropagation={(e) => e.key === 'Enter' && openViewEventModal(event)}
												tabindex="0"
												role="button"
												title={event.status === 'tentative' ? 'Tentative' : ''}
											>
												{#if event.status === 'tentative'}
													<span class="tentative-icon">?</span>
												{/if}
												{event.title}
											</div>
										{/each}
										{#if getEventsForDay(day.date, visibleEvents).length > 3}
											<div class="more-events">+{getEventsForDay(day.date, visibleEvents).length - 3} more</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<!-- Week view -->
						<div class="week-view" class:is-dragging-active={isDragging} on:mouseup={handleSlotMouseUp} on:mouseleave={handleSlotMouseUp} role="grid" aria-label="Week calendar view" tabindex="0">
							<!-- Week header -->
							<div class="week-header">
								<div class="time-gutter-header"></div>
								{#each weekDays as day, dayIndex}
									<div class="week-day-header" class:is-today={isToday(day)}>
										<span class="day-name">{dayNames[dayIndex]}</span>
										<span class="day-num" class:today-badge={isToday(day)}>{day.getDate()}</span>
									</div>
								{/each}
							</div>

							<!-- Time grid -->
							<div class="week-body" bind:this={weekBodyElement}>
								<div class="time-gutter">
									{#each timeSlots as slot, i}
										{#if slot.minute === 0}
											<div class="time-label">{slot.label}</div>
										{:else}
											<div class="time-label empty"></div>
										{/if}
									{/each}
								</div>
								{#each weekDays as day, dayIndex}
									<div class="week-day-column" class:is-today={isToday(day)}>
										{#each timeSlots as slot, slotIndex}
											<div 
												class="time-slot"
												class:is-hour={slot.minute === 30}
												class:is-dragging={isSlotInDragRange(dayIndex, slotIndex)}
												on:mousedown={(e) => handleSlotMouseDown(e, dayIndex, slotIndex)}
												on:mousemove={(e) => handleSlotMouseMove(e, dayIndex, slotIndex)}
												role="button"
												tabindex="0"
											>
												{#each getEventsForSlot(day, slot.hour, slot.minute, visibleEvents) as event (event.id)}
													{#if eventStartsInSlot(event, slot.hour, slot.minute)}
														<div 
															class="week-event"
															class:is-tentative={event.status === 'tentative'}
															style={getEventStyle(event, day)}
															on:mousedown|stopPropagation
															on:click|stopPropagation={() => openViewEventModal(event)}
															on:keydown|stopPropagation={(e) => e.key === 'Enter' && openViewEventModal(event)}
															tabindex="0"
															role="button"
															title={event.status === 'tentative' ? 'Tentative' : ''}
														>
															<span class="event-title">{event.title}</span>
															{#if event.status === 'tentative'}
																<span class="tentative-icon">?</span>
															{/if}
															{#if event.towerPlace || event.location}
																<span class="event-location">{event.towerPlace || event.location}</span>
															{/if}
														</div>
													{/if}
												{/each}
											</div>
										{/each}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</main>

<!-- View Event Modal -->
{#if showViewEventModal && viewingEvent}
	{@const isFromInvitation = viewingEvent.sourceEventId}
	{@const eventCalendar = calendars.find(c => c.id === viewingEvent.calendarId)}
	<div class="modal is-active">
		<div class="modal-background" on:click={() => showViewEventModal = false} on:keydown={(e) => e.key === 'Escape' && (showViewEventModal = false)} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">
					Event Details
				</p>
				<button class="delete" aria-label="close" on:click={() => showViewEventModal = false}></button>
			</header>
			<section class="modal-card-body">
				<h3 class="title is-4 mb-3">{viewingEvent.title}</h3>
				
				<div class="content">
					<!-- Date & Time -->
					<div class="is-flex is-align-items-center mb-3">
						<div>
							{#if viewingEvent.allDay}
								<span>{formatEventDate(viewingEvent.startDate)}</span>
								{#if viewingEvent.endDate && formatEventDate(viewingEvent.endDate) !== formatEventDate(viewingEvent.startDate)}
									<span> - {formatEventDate(viewingEvent.endDate)}</span>
								{/if}
								<span class="tag is-light ml-2">All day</span>
							{:else}
								<span>{formatEventDate(viewingEvent.startDate)} {formatEventTime(viewingEvent.startDate)}</span>
								{#if viewingEvent.endDate}
									<span> - </span>
									{#if formatEventDate(viewingEvent.endDate) !== formatEventDate(viewingEvent.startDate)}
										<span>{formatEventDate(viewingEvent.endDate)} </span>
									{/if}
									<span>{formatEventTime(viewingEvent.endDate)}</span>
								{/if}
							{/if}
						</div>
					</div>

					<!-- Calendar -->
					<div class="is-flex is-align-items-center mb-3">
						<span class="calendar-dot mr-2" style="background-color: {viewingEvent.calendarColour}"></span>
						<span>{viewingEvent.calendarName || eventCalendar?.name || 'Calendar'}</span>
						{#if isFromInvitation}
							<span class="tag is-info is-light ml-2">From Invitation</span>
						{/if}
						{#if viewingEvent.status === 'tentative'}
							<span class="tag is-warning is-light ml-2">Maybe</span>
						{/if}
					</div>

					<!-- Tower -->
					{#if viewingEvent.towerPlace}
						<div class="is-flex is-align-items-center mb-3">
							<div>
								<a href="/tower/{viewingEvent.towerID}"><span class="has-text-weight-medium">{viewingEvent.towerPlace}</span>
								{#if viewingEvent.towerDedication}
									<span class="has-text-grey">, {viewingEvent.towerDedication}</span>
								{/if}
								</a>
								{#if viewingEvent.towerBells}
									<span class="tag ml-2">{viewingEvent.towerBells} bells</span>
								{/if}
								{#if viewingEvent.towerLat && viewingEvent.towerLong}
									<a 
										href="https://www.google.com/maps/dir/?api=1&destination={viewingEvent.towerLat},{viewingEvent.towerLong}" 
										target="_blank" 
										rel="noopener noreferrer"
										class="button is-small is-info is-outlined ml-2"
									>
										<span>Get Directions</span>
									</a>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Location -->
					{#if viewingEvent.location}
						<div class="is-flex is-align-items-center mb-3">
							<span>{viewingEvent.location}</span>
							{#if !viewingEvent.towerLat && !viewingEvent.towerLong}
								<a 
									href="https://www.google.com/maps/search/?api=1&query={encodeURIComponent(viewingEvent.location)}" 
									target="_blank" 
									rel="noopener noreferrer"
									class="button is-small is-info is-outlined ml-2"
								>
									<span>Get Directions</span>
								</a>
							{/if}
						</div>
					{/if}

					<!-- Method and Composition -->
					{#if viewingEvent.method || viewingEvent.composition}
						<div class="mb-3">
							{#if viewingEvent.method}
								<p class="is-size-7 mb-1"><span class="has-text-weight-medium">Method:</span> {viewingEvent.method}</p>
							{/if}
							{#if viewingEvent.composition}
								<p class="is-size-7"><span class="has-text-weight-medium">Composition:</span> {viewingEvent.composition}</p>
							{/if}
						</div>
					{/if}

					<!-- Recurrence -->
					{#if viewingEvent.recurrenceType && viewingEvent.recurrenceType !== 'none'}
						<div class="is-flex is-align-items-center mb-3">
							<span class="has-text-grey">Repeats: </span>
							<span class="ml-1">{getRecurrenceDescription(viewingEvent.recurrenceType, viewingEvent.recurrenceInterval, viewingEvent.recurrenceEndDate, viewingEvent.startDate)}</span>
						</div>
					{/if}

					<!-- Notes -->
					{#if viewingEvent.description}
						<div class="mt-4">
							<p class="has-text-weight-medium mb-2">Notes</p>
							<p class="has-text-grey-dark" style="white-space: pre-wrap;">{viewingEvent.description}</p>
						</div>
					{/if}

					<!-- Invited People -->
					{#if loadingInvitations || viewingEventInvitations.length > 0 || (isFromInvitation && viewingEvent.organiserUsername)}
						<div class="mt-4">
							<p class="has-text-weight-medium mb-2">Ringers ({(isFromInvitation && viewingEvent.organiserUsername ? 1 : 0) + viewingEventInvitations.length})</p>
							{#if loadingInvitations}
								<p class="has-text-grey is-size-7">Loading...</p>
							{:else}
								<div class="invited-list">
									<!-- Organiser (shown first for invitation-based events) -->
									{#if isFromInvitation && viewingEvent.organiserUsername}
										<div class="invited-item is-flex is-align-items-center mb-2">
											<a href="/u/{viewingEvent.organiserUsername.replace(/ /g, '-')}" class="is-flex is-align-items-center">
												{#if viewingEvent.organiserProfileImage}
													<figure class="image is-24x24 mr-2">
														<img class="is-rounded" src="/uploads/profiles/{viewingEvent.organiserProfileImage}" alt="{viewingEvent.organiserUsername}" />
													</figure>
												{/if}
												<span>{viewingEvent.organiserUsername}</span>
											</a>
											<span class="ml-auto">
												<span class="tag is-primary is-light">Organiser</span>
											</span>
										</div>
									{/if}
									{#each viewingEventInvitations as invite}
										<div class="invited-item is-flex is-align-items-center mb-2">
											{#if invite.invitedUserId}
												<a href="/u/{invite.username}" class="is-flex is-align-items-center">
													{#if invite.profileImage}
														<figure class="image is-24x24 mr-2">
															<img class="is-rounded" src="/uploads/profiles/{invite.profileImage}" alt="{invite.username}" />
														</figure>
													{/if}
													<span>{invite.username}</span>
												</a>
											{:else}
												<span class="has-text-grey">{invite.guestName} <span class="is-size-7">(guest)</span></span>
											{/if}
											<span class="ml-auto">
												{#if invite.status === 'accepted'}
													<span class="tag is-success is-light">Accepted</span>
												{:else if invite.status === 'declined'}
													<span class="tag is-danger is-light">Declined</span>
												{:else if invite.status === 'maybe'}
													<span class="tag is-warning is-light">Maybe</span>
												{:else if invite.status === 'guest'}
													<span class="tag is-info is-light">Guest</span>
												{:else}
													<span class="tag is-light">Pending</span>
												{/if}
											</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</section>
			<footer class="modal-card-foot">
				{#if !isFromInvitation}
					<button class="button is-primary" on:click={editFromViewModal}>
						<span>Edit</span>
					</button>
					<button class="button is-danger is-outlined" on:click={deleteFromViewModal}>
						<span>Delete</span>
					</button>
				{:else}
					<button class="button is-danger is-outlined" on:click={deleteFromViewModal}>
						<span>Remove from Calendar</span>
					</button>
				{/if}
				<button class="button" on:click={() => showViewEventModal = false}>Close</button>
			</footer>
		</div>
	</div>
{/if}

<!-- View Shared Event Modal -->
{#if showViewSharedEventModal && viewingSharedEvent}
	<div class="modal is-active">
		<div class="modal-background" on:click={() => showViewSharedEventModal = false} on:keydown={(e) => e.key === 'Escape' && (showViewSharedEventModal = false)} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">
					Event Details
				</p>
				<button class="delete" aria-label="close" on:click={() => showViewSharedEventModal = false}></button>
			</header>
			<section class="modal-card-body">
				<h3 class="title is-4 mb-3">{viewingSharedEvent.title}</h3>
				
				<div class="content">
					<!-- Date & Time -->
					<div class="is-flex is-align-items-center mb-3">
						<div>
							{#if viewingSharedEvent.allDay}
								<span>{formatEventDate(viewingSharedEvent.startDate)}</span>
								{#if viewingSharedEvent.endDate && formatEventDate(viewingSharedEvent.endDate) !== formatEventDate(viewingSharedEvent.startDate)}
									<span> - {formatEventDate(viewingSharedEvent.endDate)}</span>
								{/if}
								<span class="tag is-light ml-2">All day</span>
							{:else}
								<span>{formatEventDate(viewingSharedEvent.startDate)} {formatEventTime(viewingSharedEvent.startDate)}</span>
								{#if viewingSharedEvent.endDate}
									<span> - </span>
									{#if formatEventDate(viewingSharedEvent.endDate) !== formatEventDate(viewingSharedEvent.startDate)}
										<span>{formatEventDate(viewingSharedEvent.endDate)} </span>
									{/if}
									<span>{formatEventTime(viewingSharedEvent.endDate)}</span>
								{/if}
							{/if}
						</div>
					</div>

					<!-- Shared Calendar -->
					<div class="is-flex is-align-items-center mb-3">
						<span class="calendar-dot mr-2" style="background-color: {viewingSharedEvent.calendarColour}"></span>
						<span>{viewingSharedEvent.calendarName}</span>
						<span class="tag is-info is-light ml-2">(Shared)</span>
					</div>

					<!-- Tower -->
					{#if viewingSharedEvent.towerPlace}
						<div class="is-flex is-align-items-center mb-3">
							<div>
								<a href="/tower/{viewingSharedEvent.towerID}"><span class="has-text-weight-medium">{viewingSharedEvent.towerPlace}</span>
								{#if viewingSharedEvent.towerDedication}
									<span class="has-text-grey">, {viewingSharedEvent.towerDedication}</span>
								{/if}
								</a>
								{#if viewingSharedEvent.towerBells}
									<span class="tag ml-2">{viewingSharedEvent.towerBells} bells</span>
								{/if}
								{#if viewingSharedEvent.towerLat && viewingSharedEvent.towerLong}
									<a 
										href="https://www.google.com/maps/dir/?api=1&destination={viewingSharedEvent.towerLat},{viewingSharedEvent.towerLong}" 
										target="_blank" 
										rel="noopener noreferrer"
										class="button is-small is-info is-outlined ml-2"
									>
										<span>Get Directions</span>
									</a>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Location -->
					{#if viewingSharedEvent.location}
						<div class="is-flex is-align-items-center mb-3">
							<span>{viewingSharedEvent.location}</span>
							{#if !viewingSharedEvent.towerLat && !viewingSharedEvent.towerLong}
								<a 
									href="https://www.google.com/maps/search/?api=1&query={encodeURIComponent(viewingSharedEvent.location)}" 
									target="_blank" 
									rel="noopener noreferrer"
									class="button is-small is-info is-outlined ml-2"
								>
									<span>Get Directions</span>
								</a>
							{/if}
						</div>
					{/if}

					<!-- Method and Composition -->
					{#if viewingSharedEvent.method || viewingSharedEvent.composition}
						<div class="mb-3">
							{#if viewingSharedEvent.method}
								<p class="is-size-7 mb-1"><span class="has-text-weight-medium">Method:</span> {viewingSharedEvent.method}</p>
							{/if}
							{#if viewingSharedEvent.composition}
								<p class="is-size-7"><span class="has-text-weight-medium">Composition:</span> {viewingSharedEvent.composition}</p>
							{/if}
						</div>
					{/if}

					<!-- Recurrence -->
					{#if viewingSharedEvent.recurrenceType && viewingSharedEvent.recurrenceType !== 'none'}
						<div class="is-flex is-align-items-center mb-3">
							<span class="has-text-grey">Repeats: </span>
							<span class="ml-1">{getRecurrenceDescription(viewingSharedEvent.recurrenceType, viewingSharedEvent.recurrenceInterval, viewingSharedEvent.recurrenceEndDate, viewingSharedEvent.startDate)}</span>
						</div>
					{/if}

					<!-- Description -->
					{#if viewingSharedEvent.description}
						<div class="mt-4">
							<p class="has-text-weight-medium mb-2">Description</p>
							<p class="has-text-grey-dark" style="white-space: pre-wrap;">{viewingSharedEvent.description}</p>
						</div>
					{/if}

					<!-- Created By -->
					<div class="mt-4">
						<p class="has-text-weight-medium mb-2">Created by</p>
						<p class="is-size-7">{viewingSharedEvent.createdByUsername}</p>
					</div>
				</div>
			</section>
			<footer class="modal-card-foot">
				<button class="button is-primary" on:click={editSharedEventFromViewModal}>
					<span>Edit</span>
				</button>
				<button class="button is-danger is-outlined" on:click={deleteSharedEventFromViewModal}>
					<span>Delete</span>
				</button>
				<button class="button" on:click={() => showViewSharedEventModal = false}>Close</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Invite to Event Modal -->
<!-- Event Modal -->
{#if showEventModal}
	{@const isFromInvitation = editingEvent && editingEvent.sourceEventId}
	<div class="modal is-active">
		<div class="modal-background" on:click={() => showEventModal = false} on:keydown={(e) => e.key === 'Escape' && (showEventModal = false)} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">
					{editingEvent ? 'Edit Event' : 'New Event'}
					{#if isFromInvitation}
						<span class="tag is-info ml-2">From Invitation</span>
					{/if}
				</p>
				<button class="delete" aria-label="close" on:click={() => showEventModal = false}></button>
			</header>
			<section class="modal-card-body event-modal-body">
			{#if isFromInvitation}
				<div class="notification is-warning is-light mb-4">
					This event was added from an invitation and cannot be edited. Contact the organiser to make changes.
				</div>
			{/if}
				<div class="field">
					<label class="label" for="event-title">Title</label>
					<div class="control">
						<input id="event-title" class="input" type="text" bind:value={eventForm.title} placeholder="Event title" disabled={isFromInvitation} />
					</div>
				</div>

				<div class="field">
					<label class="label" for="event-calendar">Calendar</label>
					<div class="control">
						<div class="select is-fullwidth">
							<select id="event-calendar" bind:value={eventForm.calendarId} disabled={isFromInvitation}>
								{#each calendars as calendar}
									<option value={calendar.id}>{calendar.name}</option>
								{/each}
								{#if sharedCalendars.filter(c => c.role === 'owner' || c.role === 'editor').length > 0}
									<option disabled>── Shared Calendars ──</option>
									{#each sharedCalendars.filter(c => c.role === 'owner' || c.role === 'editor') as sc}
										<option value="shared-{sc.id}">{sc.name} (Shared)</option>
									{/each}
								{/if}
							</select>
						</div>
					</div>
					{#if typeof eventForm.calendarId === 'string' && eventForm.calendarId.startsWith('shared-')}
						<p class="help has-text-info">
							This event will be added to a shared calendar visible to all members.
						</p>
					{:else if calendars.find(c => c.id === eventForm.calendarId)?.requireOrganise}
						<p class="help has-text-info">
							<strong>Tip:</strong> For {calendars.find(c => c.id === eventForm.calendarId)?.name}, consider adding a tower and inviting ringers below.
						</p>
					{/if}
				</div>

				<div class="field">
					<label class="checkbox">
						<input type="checkbox" bind:checked={eventForm.allDay} disabled={isFromInvitation} />
						All day
					</label>
				</div>

				<div class="columns">
					<div class="column">
						<div class="field">
							<label class="label" for="event-start-date">Start Date</label>
							<div class="control">
								<input id="event-start-date" class="input" type="date" bind:value={eventForm.startDate} disabled={isFromInvitation} />
							</div>
						</div>
					</div>
					{#if !eventForm.allDay}
						<div class="column">
							<div class="field">
								<label class="label" for="event-start-time">Start Time</label>
								<div class="control">
									<input id="event-start-time" class="input" type="time" bind:value={eventForm.startTime} disabled={isFromInvitation} />
								</div>
							</div>
						</div>
					{/if}
				</div>

				<div class="columns">
					<div class="column">
						<div class="field">
							<label class="label" for="event-end-date">End Date</label>
							<div class="control">
								<input id="event-end-date" class="input" type="date" bind:value={eventForm.endDate} disabled={isFromInvitation} />
							</div>
						</div>
					</div>
					{#if !eventForm.allDay}
						<div class="column">
							<div class="field">
								<label class="label" for="event-end-time">End Time</label>
								<div class="control">
									<input id="event-end-time" class="input" type="time" bind:value={eventForm.endTime} disabled={isFromInvitation} />
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Tower Search (for organised events) -->
				{#if !isFromInvitation}
					<div class="field">
						<label class="label" for="tower-search">Tower</label>
						{#if selectedTower}
							<div class="box p-3 mb-2 selected-tower-box">
								<div class="is-flex is-justify-content-space-between is-align-items-center">
									<div>
										<p class="has-text-weight-medium">{selectedTower.Place}, {selectedTower.Dedicn}</p>
										<p class="is-size-7 has-text-grey">
											{selectedTower.County}
											{#if selectedTower.Bells}
												• {selectedTower.Bells} bells
											{/if}
										</p>
									</div>
									<button class="delete" on:click={clearTower} aria-label="Remove tower"></button>
								</div>
							</div>
						{:else}
							<div class="control" class:is-loading={searchingTowers}>
								<input 
									id="tower-search"
									class="input" 
									type="text" 
									placeholder="Search for a tower..."
									bind:value={towerSearch}
									on:input={(e) => searchTowers(e.target.value)}
								/>
							</div>
							{#if towerResults.length > 0}
								<div class="box mt-2 p-2" style="max-height: 200px; overflow-y: auto;">
									{#each towerResults as tower}
										<div 
											class="tower-result p-2 is-clickable"
											style="border-radius: 4px;"
											role="button"
											tabindex="0"
											on:click={() => selectTower(tower)}
											on:keydown={(e) => e.key === 'Enter' && selectTower(tower)}
										>
											<p class="has-text-weight-medium is-size-7">{tower.Place}, {tower.Dedicn}</p>
											<p class="is-size-7 has-text-grey">
												{tower.County}
												{#if tower.Bells}
													• {tower.Bells} bells
												{/if}
											</p>
										</div>
									{/each}
								</div>
							{/if}
						{/if}
						{#if editingEvent && editingEvent.towerPlace}
							<p class="help">
								Tower: {editingEvent.towerPlace}, {editingEvent.towerDedication}
								{#if editingEvent.towerBells}
									({editingEvent.towerBells} bells)
								{/if}
							</p>
						{/if}
						{#if !editingEvent || !editingEvent.towerPlace}
							<p class="help">Search for a tower to link this event to a specific location.</p>
						{/if}
					</div>
				{/if}

				<div class="field">
					<label class="label" for="event-location">Location</label>
					<div class="control">
						<input id="event-location" class="input" type="text" bind:value={eventForm.location} placeholder="Location" disabled={isFromInvitation} />
					</div>
				</div>

				<div class="field">
					<label class="label" for="event-method">Method</label>
					<div class="control">
						<input id="event-method" class="input" type="text" bind:value={eventForm.method} placeholder="Stedman Triples" disabled={isFromInvitation} />
					</div>
				</div>

				<div class="field">
					<label class="label" for="event-composition">Composition</label>
					<div class="control">
						<input id="event-composition" class="input" type="text" bind:value={eventForm.composition} placeholder="https://complib.org/composition/90068" disabled={isFromInvitation} />
					</div>
				</div>

				<div class="field">
					<label class="label" for="event-description">Notes</label>
					<div class="control">
						<textarea id="event-description" class="textarea" bind:value={eventForm.description} placeholder="Notes" disabled={isFromInvitation}></textarea>
					</div>
				</div>

				<!-- Invite Users -->
				{#if !isFromInvitation}
					<div class="field">
						<p class="label">Invite Ringers</p>
						<UserSearch 
							onUserSelect={addInvitedUser}
							excludeUserIds={[data.user.id, ...invitedUsers.filter(u => !u.isGuest).map(u => u.id)]}
							placeholder="Search for ringers to invite..."
							showAddButton={true}
						/>
		
						<!-- Invite from user lists -->
						<div class="field mt-3">
							<label class="label" for="invite-from-list-select">Invite From List</label>
							<div class="control">
								<div class="select is-small">
									<select id="invite-from-list-select" bind:value={selectedUserListId} on:change={() => selectUserList(selectedUserListId)}>
										<option value="" disabled>Choose a list</option>
										{#each userLists as l}
											<option value={l.id}>{l.name} ({l.memberCount || 0})</option>
										{/each}
									</select>
								</div>
							</div>
							{#if selectedListMembers.length > 0}
								<div class="list-members mt-2">
									{#each selectedListMembers as member}
										<div class="list-row">
											<div style="display:flex;align-items:center;gap:0.75rem;">
												{#if member.profileImage}
													<img src=/uploads/profiles/{member.profileImage} alt="{member.username}" class="list-row-avatar" />
												{:else}
													<div class="list-row-avatar-placeholder"></div>
												{/if}
												<div>
													<div class="has-text-weight-medium">{member.otherNames || member.username}</div>
													<div class="is-size-7 has-text-grey">{member.username}</div>
												</div>
											</div>
											<div>
												<button class="button is-small is-primary" on:click={() => addInvitedUser({ id: member.id, username: member.username, displayName: member.otherNames })} disabled={invitedUsers.find(u => u.id === member.id)}>
													{invitedUsers.find(u => u.id === member.id) ? 'Invited' : 'Invite'}
												</button>
											</div>
										</div>
									{/each}
								</div>
							{:else if loadingListMembers}
								<p class="is-size-7">Loading list members…</p>
							{:else if selectedUserListId}
								<p class="is-size-7 has-text-grey">No members in this list.</p>
							{/if}
							<p class="help">Select a list to quickly invite many ringers.</p>
						</div>
						
						<!-- Guest name input for people not in the system -->
						<div class="field has-addons mt-2">
							<div class="control is-expanded">
								<input 
									class="input is-small" 
									type="text" 
									placeholder="Or enter a name for someone not on TowerTracker..."
									bind:value={guestNameInput}
									on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addGuestInvite())}
								/>
							</div>
							<div class="control">
								<button class="button is-small is-info" on:click={addGuestInvite} disabled={!guestNameInput.trim()}>
									Add Guest
								</button>
							</div>
						</div>
						
						{#if invitedUsers.length > 0}
							<div class="mt-2">
								<p class="is-size-7 has-text-weight-medium mb-2">Invited ({invitedUsers.length}):</p>
								<div class="tags">
									{#each invitedUsers as user}
										<span class="tag" class:is-info={!user.isGuest} class:is-warning={user.isGuest}>
											{#if user.isGuest}
												{user.guestName} <span class="is-size-7 ml-1">(guest)</span>
											{:else}
												{user.displayName || user.username}
											{/if}
											<button class="delete is-small" on:click={() => removeInvitedUser(user.id)} aria-label="Remove {user.isGuest ? user.guestName : (user.displayName || user.username)}"></button>
										</span>
									{/each}
								</div>
							</div>
						{/if}
						<p class="help">Registered users will receive a notification. Guests are for your reference only.</p>
					</div>
				{/if}

				<!-- Recurrence -->
				{#if !isFromInvitation}
					<div class="field">
						<label class="label" for="recurrence-type">Repeat</label>
						<div class="control">
							<div class="select is-fullwidth">
								<select id="recurrence-type" bind:value={eventForm.recurrenceType}>
									<option value="none">Does not repeat</option>
									<option value="daily">Daily</option>
									<option value="weekly">Weekly</option>
									<option value="monthly">Monthly (same date)</option>
									<option value="monthly_nth">Monthly (same weekday)</option>
									<option value="yearly">Yearly</option>
								</select>
							</div>
						</div>
						{#if eventForm.recurrenceType !== 'none'}
							<p class="help has-text-info">
								{getRecurrenceDescription(eventForm.recurrenceType, eventForm.recurrenceInterval, eventForm.recurrenceEndDate, eventForm.startDate)}
							</p>
						{/if}
					</div>
					
					{#if eventForm.recurrenceType !== 'none'}
						<div class="columns">
							<div class="column">
								<div class="field">
									<label class="label" for="recurrence-interval">Every</label>
									<div class="field has-addons">
										<div class="control">
											<input 
												id="recurrence-interval"
												class="input" 
												type="number" 
												min="1" 
												max="99"
												bind:value={eventForm.recurrenceInterval}
											/>
										</div>
										<div class="control">
											<span class="button is-static">
												{#if eventForm.recurrenceType === 'daily'}day(s)
												{:else if eventForm.recurrenceType === 'weekly'}week(s)
												{:else if eventForm.recurrenceType === 'monthly' || eventForm.recurrenceType === 'monthly_nth'}month(s)
												{:else if eventForm.recurrenceType === 'yearly'}year(s)
												{/if}
											</span>
										</div>
									</div>
								</div>
							</div>
							<div class="column">
								<div class="field">
									<label class="label" for="recurrence-end">Until (optional)</label>
									<div class="control">
										<input 
											id="recurrence-end"
											class="input" 
											type="date" 
											bind:value={eventForm.recurrenceEndDate}
										/>
									</div>
									<p class="help">Leave empty for no end date</p>
								</div>
							</div>
						</div>
					{/if}
				{/if}

				<div class="field">
					<label class="label" for="event-description">Notes</label>
					<div class="control">
						<textarea id="event-description" class="textarea" bind:value={eventForm.description} placeholder="Notes" disabled={isFromInvitation}></textarea>
					</div>
				</div>

				{#if editingEvent && editingEvent.status === 'tentative'}
					<div class="notification is-warning is-light">
						<strong>Tentative</strong> - You responded "maybe" to this event invitation.
					</div>
				{/if}

				{#if editingEvent && editingEvent.sourceEventId}
					<div class="notification is-info is-light">
						This event was added from an invitation.
					</div>
				{/if}

				<!-- Invitations Tab (for regular events, both new and existing) -->
				{#if !isFromInvitation && eventModalTab === 'invitations'}
					{#if !editingEvent?.recurrenceType || editingEvent?.recurrenceType === 'none' || editingEvent?.editScope === 'single'}
						<div class="invitations-section">
							<!-- Add New Invitation -->
						<div class="box mb-4 p-4">
							<p class="has-text-weight-bold mb-3">📬 Send Invitation</p>
							
							<div class="field">
								<label class="label is-small">Search for user or enter guest name</label>
								<div class="control is-expanded">
									<input 
										class="input" 
										type="text"
										placeholder="Type user name or guest name..."
										bind:value={inviteSearchQuery}
										on:input={(e) => searchInviteUsers(e.target.value)}
									/>
								</div>
								{#if searchingInvites}
									<p class="is-size-7 has-text-grey mt-1">Searching...</p>
								{/if}
								{#if inviteSearchResults.length > 0}
									<div class="box mt-2" style="max-height: 150px; overflow-y: auto;">
										{#each inviteSearchResults as user}
											<div 
												class="px-2 py-1 mb-1" 
												style="cursor: pointer; border-radius: 4px; border: 1px solid #e0e0e0; transition: background-color 0.2s;"
												on:click={() => selectUserForInvite(user)}
												on:keydown={(e) => e.key === 'Enter' && selectUserForInvite(user)}
												on:mouseover={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
												on:mouseout={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
												role="button"
												tabindex="0"
											>
												<strong class="is-size-7">{user.username}</strong>
												{#if user.email}
													<span class="is-size-7 has-text-grey ml-1">({user.email})</span>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>

							{#if inviteForm.invitedUserId}
								<div class="field">
									<label class="label is-small">Selected User</label>
									<div class="box p-2 has-background-info-light" style="border-left: 3px solid #3273dc;">
										<div class="is-flex is-justify-content-space-between is-align-items-center">
											<span class="is-size-7"><strong>{inviteSearchQuery}</strong></span>
											<button 
												class="button is-small is-ghost"
												on:click={() => {
													inviteForm.invitedUserId = null;
													inviteSearchQuery = '';
													inviteSearchResults = [];
												}}
											>
												✕
											</button>
										</div>
									</div>
								</div>
							{:else}
								<div class="field">
									<label class="label is-small">Or enter guest name (if no user account)</label>
									<div class="control">
										<input 
											class="input"
											type="text"
											placeholder="Guest name..."
											bind:value={inviteForm.guestName}
										/>
									</div>
								</div>
							{/if}

							<div class="mt-3">
								<button class="button is-small is-primary" on:click={submitRegularEventInvite}>
									+ Send Invitation
								</button>
								<button class="button is-small ml-2" on:click={() => { inviteForm = { invitedUserId: null, guestName: '', instanceDate: null }; inviteSearchQuery = ''; inviteSearchResults = []; }}>
									Clear
								</button>
							</div>
						</div>

						<!-- Existing Invitations -->
						<div>
							<p class="has-text-weight-bold mb-3">Ringers Invited ({regularEventInvitations.length})</p>
							{#if loadingEventInvitations}
								<p class="has-text-grey">Loading invitations...</p>
							{:else if regularEventInvitations.length === 0}
								<p class="has-text-grey is-size-7">No invitations sent yet</p>
							{:else}
								<div class="invitations-list">
									{#each regularEventInvitations as invitation}
										<div class="invitation-item mb-3 p-3" style="border-left: 3px solid {invitation.isPending ? '#ffdd57' : invitation.status === 'accepted' ? '#48c774' : invitation.status === 'declined' ? '#f14668' : invitation.status === 'maybe' ? '#3e8ed0' : '#dbdbdb'}; background-color: #fafafa; border-radius: 4px;">
											<div class="is-flex is-justify-content-space-between is-align-items-start">
												<div class="is-flex-grow-1">
													<p class="has-text-weight-medium is-size-7 mb-1">
														{invitation.invitedUsername || invitation.guestName}
													</p>
													{#if invitation.instanceDate}
														<p class="is-size-7 has-text-grey mb-1">
															Instance: {new Date(invitation.instanceDate).toLocaleDateString()}
														</p>
													{/if}
													<div>
														{#if invitation.isPending}
															<span class="tag is-warning is-light is-size-7">Pending</span>
														{:else if invitation.status === 'accepted'}
															<span class="tag is-success is-light is-size-7">Accepted</span>
														{:else if invitation.status === 'declined'}
															<span class="tag is-danger is-light is-size-7">Declined</span>
														{:else if invitation.status === 'maybe'}
															<span class="tag is-info is-light is-size-7">Maybe</span>
														{:else}
															<span class="tag is-light is-size-7">Pending</span>
														{/if}
													</div>
												</div>
												<button 
													class="button is-small is-ghost has-text-danger"
													on:click={() => removeRegularEventInvitation(invitation.id)}
													title="Remove invitation"
												>
													🗑
												</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
					{:else if editingEvent?.recurrenceType && editingEvent?.recurrenceType !== 'none' && editingEvent?.editScope !== 'single'}
						<div class="notification is-info is-light">
							<p class="is-size-7">Invitations can only be sent when editing a specific event instance.</p>
						</div>
					{/if}
				{/if}
			</section>
			<footer class="modal-card-foot">
				{#if editingEvent && editingEvent.sourceEventId}
					<!-- Read-only event from invitation - only allow removing from calendar -->
					<button class="button is-danger is-outlined" on:click={deleteEvent}>
						<span>Remove from Calendar</span>
					</button>
				{:else}
					<button class="button is-primary" on:click={saveEvent}>
						{editingEvent ? 'Update' : 'Create'}
					</button>
					{#if editingEvent}
						<button class="button is-danger" on:click={deleteEvent}>Delete</button>
					{/if}
				{/if}
				<button class="button" on:click={() => showEventModal = false}>Cancel</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Calendar Modal -->
{#if showCalendarModal}
	<div class="modal is-active">
		<div class="modal-background" on:click={() => showCalendarModal = false} on:keydown={(e) => e.key === 'Escape' && (showCalendarModal = false)} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">{editingCalendar ? 'Edit Calendar' : 'New Calendar'}</p>
				<button class="delete" aria-label="close" on:click={() => showCalendarModal = false}></button>
			</header>
			<section class="modal-card-body">
				{#if !editingCalendar?.isPreset}
					<div class="field">
						<label class="label" for="calendar-name">Name</label>
						<div class="control">
							<input id="calendar-name" class="input" type="text" bind:value={calendarForm.name} placeholder="Calendar name" />
						</div>
					</div>
				{/if}

				<div class="field">
					<label class="label" for="calendar-colour">Colour</label>
					<div class="control">
						<input id="calendar-colour" class="input" type="color" bind:value={calendarForm.colour} style="height: 40px; padding: 4px;" />
					</div>
				</div>
			</section>
			<footer class="modal-card-foot">
				<button class="button is-primary" on:click={saveCalendar}>
					{editingCalendar ? 'Update' : 'Create'}
				</button>
				{#if editingCalendar && !editingCalendar.isPreset}
					<button class="button is-danger" on:click={deleteCalendar}>Delete</button>
				{/if}
				<button class="button" on:click={() => showCalendarModal = false}>Cancel</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Settings Modal -->
{#if showSettingsModal}
	<div class="modal is-active">
		<div class="modal-background" on:click={() => showSettingsModal = false} on:keydown={(e) => e.key === 'Escape' && (showSettingsModal = false)} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">Calendar Settings</p>
				<button class="delete" aria-label="close" on:click={() => showSettingsModal = false}></button>
			</header>
			<section class="modal-card-body">
				<h4 class="title is-5">iCal Subscription Links</h4>
				<p class="mb-4">
					You can subscribe to individual calendars using the menu next to each calendar in the sidebar. 
					Use these links in Google Calendar, Apple Calendar, Outlook, or other apps.
				</p>

				{#if loadingSecret}
					<p class="has-text-grey">Loading...</p>
				{:else if icalSecret}
					<div class="notification">
						<p class="mb-2"><strong>Security</strong></p>
						<p class="is-size-7">Your calendar links contain a secret key. Keep these links private! Anyone with the link can view your calendar events.</p>
					</div>

					{#if icalSecret.lastAccessed}
						<p class="is-size-7 has-text-grey mt-3 mb-3">
							Last accessed: {new Date(icalSecret.lastAccessed).toLocaleString()}
						</p>
					{/if}

					<hr />

					<p class="mb-3">If you believe your calendar links have been compromised, you can regenerate your secret key. This will invalidate all existing links.</p>

					<button class="button is-warning" on:click={regenerateSecret}>
						<span>↻ Regenerate Secret Key</span>
					</button>
					<p class="help is-warning">This will invalidate all existing iCal calendar subscriptions.</p>
				{/if}
			</section>
			<footer class="modal-card-foot">
				<button class="button" on:click={() => showSettingsModal = false}>Close</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Recurrence Edit Modal -->
{#if showRecurrenceEditModal && pendingRecurrenceEdit}
	<div class="modal is-active">
		<div class="modal-background" on:click={cancelRecurrenceEdit} on:keydown={(e) => e.key === 'Escape' && cancelRecurrenceEdit()} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card" style="max-width: 450px;">
			<header class="modal-card-head">
				<p class="modal-card-title">Edit Recurring Event</p>
				<button class="delete" aria-label="close" on:click={cancelRecurrenceEdit}></button>
			</header>
			<section class="modal-card-body">
				<p class="mb-4">This is a recurring event. How would you like to edit it?</p>
				
				<div class="buttons is-flex is-flex-direction-column">
					<button class="button is-fullwidth is-justify-content-flex-start" on:click={() => handleRecurrenceEditChoice('single')}>
						<span class="icon mr-2">📅</span>
						<span>
							<strong>This event only</strong>
							<br><small class="has-text-grey">Only this occurrence will be changed</small>
						</span>
					</button>
					
					<button class="button is-fullwidth is-justify-content-flex-start" on:click={() => handleRecurrenceEditChoice('future')}>
						<span class="icon mr-2">📆</span>
						<span>
							<strong>This and future events</strong>
							<br><small class="has-text-grey">This and all following occurrences will be changed</small>
						</span>
					</button>
					
					<button class="button is-fullwidth is-justify-content-flex-start" on:click={() => handleRecurrenceEditChoice('all')}>
						<span class="icon mr-2">🔄</span>
						<span>
							<strong>All events in the series</strong>
							<br><small class="has-text-grey">All occurrences will be changed</small>
						</span>
					</button>
				</div>
			</section>
			<footer class="modal-card-foot">
				<button class="button" on:click={cancelRecurrenceEdit}>Cancel</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Shared Event Recurrence Edit Modal -->
{#if showSharedRecurrenceEditModal && pendingSharedRecurrenceEdit}
	<div class="modal is-active">
		<div class="modal-background" on:click={cancelSharedRecurrenceEdit} on:keydown={(e) => e.key === 'Escape' && cancelSharedRecurrenceEdit()} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card" style="max-width: 450px;">
			<header class="modal-card-head">
				<p class="modal-card-title">Edit Recurring Event</p>
				<button class="delete" aria-label="close" on:click={cancelSharedRecurrenceEdit}></button>
			</header>
			<section class="modal-card-body">
				<p class="mb-4">This is a recurring event. How would you like to edit it?</p>
				
				<div class="buttons is-flex is-flex-direction-column">
					<button class="button is-fullwidth is-justify-content-flex-start" on:click={() => handleSharedRecurrenceEditChoice('single')}>
						<span class="icon mr-2">📅</span>
						<span>
							<strong>This event only</strong>
							<br><small class="has-text-grey">Only this occurrence will be changed</small>
						</span>
					</button>
					
					<button class="button is-fullwidth is-justify-content-flex-start" on:click={() => handleSharedRecurrenceEditChoice('future')}>
						<span class="icon mr-2">📆</span>
						<span>
							<strong>This and future events</strong>
							<br><small class="has-text-grey">This and all following occurrences will be changed</small>
						</span>
					</button>
					
					<button class="button is-fullwidth is-justify-content-flex-start" on:click={() => handleSharedRecurrenceEditChoice('all')}>
						<span class="icon mr-2">🔄</span>
						<span>
							<strong>All events in the series</strong>
							<br><small class="has-text-grey">All occurrences will be changed</small>
						</span>
					</button>
				</div>
			</section>
			<footer class="modal-card-foot">
				<button class="button" on:click={cancelSharedRecurrenceEdit}>Cancel</button>
			</footer>
		</div>
	</div>
{/if}

<!-- New Shared Calendar Modal -->
{#if showSharedCalendarModal}
	<div class="modal is-active">
		<div class="modal-background" on:click={() => showSharedCalendarModal = false} on:keydown={(e) => e.key === 'Escape' && (showSharedCalendarModal = false)} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">New Shared Calendar</p>
				<button class="delete" aria-label="close" on:click={() => showSharedCalendarModal = false}></button>
			</header>
			<section class="modal-card-body">
				<div class="field">
					<label class="label" for="shared-cal-name">Name</label>
					<div class="control">
						<input id="shared-cal-name" class="input" type="text" bind:value={sharedCalendarForm.name} placeholder="Shared calendar name" />
					</div>
				</div>
				<div class="field">
					<label class="label" for="shared-cal-colour">Colour</label>
					<div class="control">
						<input id="shared-cal-colour" class="input" type="color" bind:value={sharedCalendarForm.colour} style="height: 40px; padding: 4px;" />
					</div>
				</div>
				<div class="notification is-info is-light">
					<p class="is-size-7">After creating the calendar, you can invite other users to edit it from the manage menu.</p>
				</div>
			</section>
			<footer class="modal-card-foot">
				<button class="button is-primary" on:click={saveSharedCalendar} disabled={savingSharedCalendar}>
					{savingSharedCalendar ? 'Creating...' : 'Create'}
				</button>
				<button class="button" on:click={() => showSharedCalendarModal = false}>Cancel</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Manage Shared Calendar Modal -->
{#if showManageSharedCalendarModal && managingSharedCalendar}
	{@const isOwner = managingSharedCalendar.role === 'owner'}
	<div class="modal is-active">
		<div class="modal-background" on:click={() => showManageSharedCalendarModal = false} on:keydown={(e) => e.key === 'Escape' && (showManageSharedCalendarModal = false)} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card" style="max-width: 600px;">
			<header class="modal-card-head">
				<p class="modal-card-title">
					<span class="calendar-dot mr-2" style="background-color: {managingSharedCalendar.colour}"></span>
					{managingSharedCalendar.name}
					{#if !isOwner}
						<span class="tag is-light ml-2">{managingSharedCalendar.role}</span>
					{:else}
						<span class="tag is-primary is-light ml-2">Owner</span>
					{/if}
				</p>
				<button class="delete" aria-label="close" on:click={() => showManageSharedCalendarModal = false}></button>
			</header>
			<section class="modal-card-body">
				<!-- Edit Name & Colour (owner only for name, anyone for colour) -->
				{#if isOwner}
					<div class="field">
						<label class="label" for="manage-shared-name">Name</label>
						<div class="control">
							<input id="manage-shared-name" class="input" type="text" bind:value={sharedCalendarForm.name} />
						</div>
					</div>
				{/if}
				<div class="field">
					<label class="label" for="manage-shared-colour">Colour</label>
					<div class="control is-flex is-align-items-center" style="gap: 0.5rem;">
						<input id="manage-shared-colour" class="input" type="color" bind:value={sharedCalendarForm.colour} style="height: 40px; width: 80px; padding: 4px;" />
						<button class="button is-small" on:click={updateSharedCalendar}>Save Changes</button>
					</div>
				</div>

				<hr />

				<!-- Members Section -->
				<h4 class="title is-5 mb-3">Members</h4>

				{#if loadingSharedMembers}
					<p class="has-text-grey">Loading members...</p>
				{:else}
					<!-- Owner info -->
					<div class="shared-member-item is-flex is-align-items-center mb-2 p-2">
						<span class="has-text-weight-medium">{managingSharedCalendar.ownerUsername}</span>
						<span class="ml-auto">
							<span class="tag is-primary is-light">Owner</span>
						</span>
					</div>

					<!-- Members list -->
					{#each sharedCalendarMembers as member}
						<div class="shared-member-item is-flex is-align-items-center mb-2 p-2">
							{#if member.profileImage}
								<figure class="image is-24x24 mr-2">
									<img class="is-rounded" src="/uploads/profiles/{member.profileImage}" alt="{member.username}" />
								</figure>
							{/if}
							<span>{member.username}</span>
							{#if isOwner}
								<div class="control ml-2" style="min-width: 120px;">
									<div class="select is-small">
										<select value={member.role} on:change={(e) => updateSharedCalendarMemberRole(member.userId, e.target.value)}>
											<option value="viewer" selected={member.role === 'viewer'}>Viewer</option>
											<option value="editor" selected={member.role === 'editor'}>Editor</option>
										</select>
									</div>
								</div>
								<button class="button is-small is-danger is-outlined ml-auto" on:click={() => removeSharedCalendarMember(member.userId)}>
									Remove
								</button>
							{:else}
								<span class="tag is-light ml-2" class:is-info={member.role === 'viewer'}>{member.role}</span>
							{/if}
						</div>
					{/each}

					{#if sharedCalendarMembers.length === 0}
						<p class="has-text-grey is-size-7 mb-3">No members yet. Add users below to share this calendar.</p>
					{/if}
				{/if}
				{#if isOwner}
					<div class="field mt-3">
						<label class="label" id="add-member-label">Add Member</label>
						<UserSearch 
							onUserSelect={addSharedCalendarMember}
							excludeUserIds={[data.user.id, ...sharedCalendarMembers.map(m => m.userId)]}
							placeholder="Search for users to add..."
							showAddButton={true}
						/>
					</div>
				{/if}

				<!-- iCal Link (owner only) -->
				{#if isOwner && managingSharedCalendar.secretKey}
					<hr />
					<h4 class="title is-5 mb-3">Public iCal Link</h4>
					<div class="field">
						<div class="control">
							<input 
								class="input is-small" 
								type="text" 
								readonly 
								value="{typeof window !== 'undefined' ? window.location.origin : ''}/ical/shared/{managingSharedCalendar.secretKey}"
							/>
						</div>
						<p class="help">Share this link so others can subscribe to this calendar in their calendar app.</p>
					</div>
					<div class="buttons are-small">
						<button class="button is-info is-small" on:click={() => copySharedCalendarICalLink(managingSharedCalendar)}>
							Copy Link
						</button>
						<button class="button is-warning is-small" on:click={regenerateSharedCalendarSecret}>
							Regenerate Link
						</button>
					</div>
				{/if}

				<!-- Transfer Ownership (owner only, requires editor members) -->
				{#if isOwner && sharedCalendarMembers.some(m => m.role === 'editor')}
					<hr />
					<h4 class="title is-5 mb-3">Transfer Ownership</h4>
					<p class="is-size-7 has-text-grey mb-3">Transfer this calendar to another editor. You will become an editor.</p>
					<div class="field has-addons">
						<div class="control is-expanded">
							<div class="select is-fullwidth is-small">
								<select bind:value={transferTargetUserId}>
									<option value={null}>Select new owner...</option>
									{#each sharedCalendarMembers.filter(m => m.role === 'editor') as member}
										<option value={member.userId}>{member.username}</option>
									{/each}
								</select>
							</div>
						</div>
						<div class="control">
							<button class="button is-warning is-small" disabled={!transferTargetUserId} on:click={transferSharedCalendarOwnership}>
								Transfer
							</button>
						</div>
					</div>
				{/if}

				<!-- Delete (owner only) -->
				{#if isOwner}
					<hr />
					<button class="button is-danger is-outlined is-fullwidth" on:click={deleteSharedCalendar}>
						Delete Shared Calendar
					</button>
					<p class="help has-text-danger">This will permanently delete this calendar and all its events.</p>
				{/if}

				<!-- Leave (non-owner) -->
				{#if !isOwner}
					<hr />
					<button class="button is-danger is-outlined is-fullwidth" on:click={() => leaveSharedCalendar(managingSharedCalendar)}>
						Leave Calendar
					</button>
					<p class="help has-text-grey">You will no longer see events from this calendar.</p>
				{/if}
			</section>
			<footer class="modal-card-foot">
				<button class="button" on:click={() => showManageSharedCalendarModal = false}>Close</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Shared Event Modal -->
{#if showSharedEventModal}
	<div class="modal is-active">
		<div class="modal-background" on:click={() => showSharedEventModal = false} on:keydown={(e) => e.key === 'Escape' && (showSharedEventModal = false)} role="button" tabindex="0" aria-label="Close modal"></div>
		<div class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">
					{editingSharedEvent ? 'Edit Shared Event' : 'New Shared Event'}
					<span class="tag is-info is-light ml-2">Shared</span>
				</p>
				<button class="delete" aria-label="close" on:click={() => showSharedEventModal = false}></button>
			</header>
			<section class="modal-card-body shared-event-modal-body">
				{#if editingSharedEvent && editingSharedEvent.createdByUsername}
					<p class="is-size-7 has-text-grey mb-3">Created by {editingSharedEvent.createdByUsername}</p>
				{/if}

				<!-- Event Details and Invitations combined - tabs removed -->
				<div class="field">
					<label class="label" for="shared-event-title">Title</label>
					<div class="control">
						<input id="shared-event-title" class="input" type="text" bind:value={sharedEventForm.title} placeholder="Event title" />
					</div>
				</div>
				
				<div class="field">
					<label class="label" for="shared-event-calendar">Calendar</label>
					<div class="control">
						<div class="select is-fullwidth">
							<select id="shared-event-calendar" bind:value={sharedEventForm.sharedCalendarId}>
								{#each sharedCalendars.filter(c => c.role === 'owner' || c.role === 'editor') as calendar}
									<option value={calendar.id}>{calendar.name}</option>
								{/each}
							</select>
						</div>
					</div>
				</div>

				<div class="field">
					<label class="checkbox">
						<input type="checkbox" bind:checked={sharedEventForm.allDay} />
						All day
					</label>
				</div>

				<div class="columns">
					<div class="column">
						<div class="field">
							<label class="label" for="shared-event-start-date">Start Date</label>
							<div class="control">
								<input id="shared-event-start-date" class="input" type="date" bind:value={sharedEventForm.startDate} />
							</div>
						</div>
					</div>
					{#if !sharedEventForm.allDay}
						<div class="column">
							<div class="field">
								<label class="label" for="shared-event-start-time">Start Time</label>
								<div class="control">
									<input id="shared-event-start-time" class="input" type="time" bind:value={sharedEventForm.startTime} />
								</div>
							</div>
						</div>
					{/if}
				</div>

				<div class="columns">
						<div class="column">
							<div class="field">
								<label class="label" for="shared-event-end-date">End Date</label>
								<div class="control">
									<input id="shared-event-end-date" class="input" type="date" bind:value={sharedEventForm.endDate} />
								</div>
							</div>
						</div>
						{#if !sharedEventForm.allDay}
							<div class="column">
								<div class="field">
									<label class="label" for="shared-event-end-time">End Time</label>
									<div class="control">
										<input id="shared-event-end-time" class="input" type="time" bind:value={sharedEventForm.endTime} />
									</div>
								</div>
							</div>
						{/if}
					</div>

					<div class="field">
						<label class="label" for="shared-event-method">Method</label>
						<div class="control">
							<input id="shared-event-method" class="input" type="text" bind:value={sharedEventForm.method} placeholder="Stedman Triples" />
						</div>
					</div>

					<div class="field">
						<label class="label" for="shared-event-composition">Composition</label>
						<div class="control">
							<input id="shared-event-composition" class="input" type="text" bind:value={sharedEventForm.composition} placeholder="https://complib.org/composition/90068" />
						</div>
					</div>

					<div class="field">
						<label class="label" for="shared-event-description">Notes</label>
						<div class="control">
							<textarea id="shared-event-description" class="textarea" bind:value={sharedEventForm.description} placeholder="Notes"></textarea>
						</div>
					</div>

					<!-- Tower Search -->
					<div class="field">
						<label class="label" for="shared-tower-search">Tower</label>
						{#if selectedTower}
							<div class="box p-3 mb-2 selected-tower-box">
								<div class="is-flex is-justify-content-space-between is-align-items-center">
									<div>
										<p class="has-text-weight-medium">{selectedTower.Place}, {selectedTower.Dedicn}</p>
										{#if selectedTower.Bells}
											<p class="is-size-7 has-text-grey">{selectedTower.Bells} bells</p>
										{/if}
									</div>
									<button class="delete" on:click={clearTower} aria-label="Remove tower"></button>
								</div>
							</div>
						{:else}
							<div class="control" class:is-loading={searchingTowers}>
								<input 
									id="shared-tower-search"
									class="input" 
									type="text" 
									placeholder="Search for a tower..."
									bind:value={towerSearch}
									on:input={(e) => searchTowers(e.target.value)}
								/>
							</div>
							{#if towerResults.length > 0}
								<div class="box mt-2 p-2" style="max-height: 200px; overflow-y: auto;">
									{#each towerResults as tower}
										<div 
											class="tower-result p-2 is-clickable"
											style="border-radius: 4px;"
											role="button"
											tabindex="0"
											on:click={() => { selectTower(tower); sharedEventForm.towerID = tower.TowerID; }}
											on:keydown={(e) => e.key === 'Enter' && (selectTower(tower), sharedEventForm.towerID = tower.TowerID)}
										>
											<p class="has-text-weight-medium is-size-7">{tower.Place}, {tower.Dedicn}</p>
											<p class="is-size-7 has-text-grey">
												{tower.County}
												{#if tower.Bells}
													• {tower.Bells} bells
												{/if}
											</p>
										</div>
									{/each}
								</div>
							{:else if towerSearch}
								<div class="box mt-2 p-3 has-text-centered has-text-grey-light">
									<p class="is-size-7">No towers found. Enter a custom location above.</p>
								</div>
							{/if}
						{/if}
					</div>

					<div class="field">
						<label class="label" for="shared-event-location">Location</label>
						<div class="control">
							<input id="shared-event-location" class="input" type="text" bind:value={sharedEventForm.location} placeholder="Location (custom)" />
						</div>
						<p class="help">Enter a custom location or search for a tower below</p>
					</div>

					<!-- Recurrence -->
					<div class="field">
						<label class="label" for="shared-recurrence-type">Repeat</label>
						<div class="control">
							<div class="select is-fullwidth">
								<select id="shared-recurrence-type" bind:value={sharedEventForm.recurrenceType}>
									<option value="none">Does not repeat</option>
									<option value="daily">Daily</option>
									<option value="weekly">Weekly</option>
									<option value="monthly">Monthly (same date)</option>
									<option value="monthly_nth">Monthly (same weekday)</option>
									<option value="yearly">Yearly</option>
								</select>
							</div>
						</div>
						{#if sharedEventForm.recurrenceType !== 'none'}
							<p class="help has-text-info">
								{getRecurrenceDescription(sharedEventForm.recurrenceType, sharedEventForm.recurrenceInterval, sharedEventForm.recurrenceEndDate, sharedEventForm.startDate)}
							</p>
						{/if}
					</div>
					
					{#if sharedEventForm.recurrenceType !== 'none'}
						<div class="columns">
							<div class="column">
								<div class="field">
									<label class="label" for="shared-recurrence-interval">Every</label>
									<div class="field has-addons">
										<div class="control">
											<input 
												id="shared-recurrence-interval"
												class="input" 
												type="number" 
												min="1" 
												max="99"
												bind:value={sharedEventForm.recurrenceInterval}
											/>
										</div>
										<div class="control">
											<span class="button is-static">
												{#if sharedEventForm.recurrenceType === 'daily'}day(s)
												{:else if sharedEventForm.recurrenceType === 'weekly'}week(s)
												{:else if sharedEventForm.recurrenceType === 'monthly' || sharedEventForm.recurrenceType === 'monthly_nth'}month(s)
												{:else if sharedEventForm.recurrenceType === 'yearly'}year(s)
												{/if}
											</span>
										</div>
									</div>
								</div>
							</div>
							<div class="column">
								<div class="field">
									<label class="label" for="shared-recurrence-end">Until (optional)</label>
									<div class="control">
										<input 
											id="shared-recurrence-end"
											class="input" 
											type="date" 
											bind:value={sharedEventForm.recurrenceEndDate}
										/>
									</div>
								</div>
							</div>
						</div>
					{/if}

				<!-- Invitations Section (for shared events) - now inline with details -->
				{#if !sharedEventForm.recurrenceType || sharedEventForm.recurrenceType === 'none' || editingSharedEvent?.editScope === 'single'}
					<hr class="my-4" />
					<div class="invitations-section mt-4">
						<!-- Add New Invitation -->
						<div class="box mb-4 p-4">
							<p class="has-text-weight-bold mb-3">📬 Send Invitation</p>
						
						<div class="field">
							<label class="label is-small">Search for user or enter guest name</label>
							<div class="control is-expanded">
								<input 
									class="input" 
									type="text"
									placeholder="Type user name or guest name..."
									bind:value={inviteSearchQuery}
									on:input={(e) => searchInviteUsers(e.target.value)}
								/>
							</div>
							{#if searchingInvites}
								<p class="is-size-7 has-text-grey mt-1">Searching...</p>
							{/if}
							{#if inviteSearchResults.length > 0}
								<div class="box mt-2" style="max-height: 150px; overflow-y: auto;">
									{#each inviteSearchResults as user}
										<div 
											class="px-2 py-1 mb-1" 
											style="cursor: pointer; border-radius: 4px; border: 1px solid #e0e0e0; transition: background-color 0.2s;"
											on:click={() => selectUserForInvite(user)}
											on:keydown={(e) => e.key === 'Enter' && selectUserForInvite(user)}
											on:mouseover={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
											on:mouseout={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
											role="button"
											tabindex="0"
										>
											<strong class="is-size-7">{user.username}</strong>
											{#if user.email}
												<span class="is-size-7 has-text-grey ml-1">({user.email})</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>

						{#if inviteForm.invitedUserId}
							<div class="field">
								<label class="label is-small">Selected User</label>
								<div class="box p-2 has-background-info-light" style="border-left: 3px solid #3273dc;">
									<div class="is-flex is-justify-content-space-between is-align-items-center">
										<span class="is-size-7"><strong>{inviteSearchQuery}</strong></span>
										<button 
											class="button is-small is-ghost"
											on:click={() => {
												inviteForm.invitedUserId = null;
												inviteSearchQuery = '';
												inviteSearchResults = [];
											}}
										>
											✕
										</button>
									</div>
								</div>
							</div>
						{:else}
							<div class="field">
								<label class="label is-small">Or enter guest name (if no user account)</label>
								<div class="control">
									<input 
										class="input"
										type="text"
										placeholder="Guest name..."
										bind:value={inviteForm.guestName}
									/>
								</div>
							</div>
						{/if}

						<div class="mt-3">
							<button class="button is-small is-primary" on:click={submitInvite}>
								+ Send Invitation
							</button>
							<button class="button is-small ml-2" on:click={() => { inviteForm = { invitedUserId: null, guestName: '', instanceDate: null }; inviteSearchQuery = ''; inviteSearchResults = []; }}>
								Clear
							</button>
						</div>
					</div>

					<!-- Existing Invitations -->
					<div>
						<p class="has-text-weight-bold mb-3">Ringers Invited ({sharedEventInvitations.length})</p>
						{#if loadingEventInvitations}
							<p class="has-text-grey">Loading invitations...</p>
						{:else if sharedEventInvitations.length === 0}
							<p class="has-text-grey is-size-7">No invitations sent yet</p>
						{:else}
							<div class="invitations-list">
								{#each sharedEventInvitations as invitation}
									<div class="invitation-item mb-3 p-3" style="border-left: 3px solid {invitation.isPending ? '#ffdd57' : invitation.status === 'accepted' ? '#48c774' : invitation.status === 'declined' ? '#f14668' : invitation.status === 'maybe' ? '#3e8ed0' : '#dbdbdb'}; background-color: #fafafa; border-radius: 4px;">
										<div class="is-flex is-justify-content-space-between is-align-items-start">
											<div class="is-flex-grow-1">
												<p class="has-text-weight-medium is-size-7 mb-1">
													{invitation.invitedUsername || invitation.guestName}
												</p>
												{#if invitation.instanceDate}
													<p class="is-size-7 has-text-grey mb-1">
														Instance: {new Date(invitation.instanceDate).toLocaleDateString()}
													</p>
												{/if}
												<div>
													{#if invitation.isPending}
														<span class="tag is-warning is-light is-size-7">Pending</span>
													{:else if invitation.status === 'accepted'}
														<span class="tag is-success is-light is-size-7">Accepted</span>
													{:else if invitation.status === 'declined'}
														<span class="tag is-danger is-light is-size-7">Declined</span>
													{:else if invitation.status === 'maybe'}
														<span class="tag is-info is-light is-size-7">Maybe</span>
													{:else}
														<span class="tag is-light is-size-7">Pending</span>
													{/if}
												</div>
											</div>
											<button 
												class="button is-small is-ghost has-text-danger"
												on:click={() => removeInvitation(invitation.id)}
												title="Remove invitation"
											>
												🗑
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
				{:else if sharedEventForm.recurrenceType && sharedEventForm.recurrenceType !== 'none' && editingSharedEvent?.editScope !== 'single'}
					<div class="notification is-info is-light mt-4">
						<p class="is-size-7">Invitations can only be sent when editing a specific event instance.</p>
					</div>
				{/if}
			</section>
			<footer class="modal-card-foot">
				<button class="button is-primary" on:click={saveSharedEvent}>
					{editingSharedEvent ? 'Update' : 'Create'}
				</button>
				{#if editingSharedEvent}
					<button class="button is-danger" on:click={deleteSharedEvent}>Delete</button>
				{/if}
				<button class="button" on:click={() => showSharedEventModal = false}>Close</button>
			</footer>
		</div>
	</div>
{/if}

<Footer />

