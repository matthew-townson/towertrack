<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import UserSearch from '$lib/components/UserSearch.svelte';
    
    export let data;
    
    const { user, calendars } = data;
    let recentEvents = data.recentEvents;
    let invitations = data.invitations;
    
    // Event form state
    let eventForm = {
        calendarId: '',
        title: '',
        description: '',
        location: '',
        towerID: null,
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        allDay: false,
        recurrenceType: 'none',
        recurrenceInterval: 1,
        recurrenceEndDate: ''
    };
    
    // Tower search state
    let towerSearch = '';
    let towerResults = [];
    let selectedTower = null;
    let searchingTowers = false;
    
    // Invited users
    let invitedUsers = [];
    
    // UI state
    let isSubmitting = false;
    let showSuccess = false;
    let errorMessage = '';
    let activeTab = 'create';
    
    // Edit modal state
    let showEditModal = false;
    let editingEvent = null;
    let editForm = {
        title: '',
        description: '',
        location: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        allDay: false,
        recurrenceType: 'none',
        recurrenceInterval: 1,
        recurrenceEndDate: ''
    };
    
    // Get calendars that allow or require organise mode
    $: organiseCalendars = calendars.filter(c => c.requireOrganise || c.presetType === 'quarter_peal' || c.presetType === 'peal');
    $: otherCalendars = calendars.filter(c => !c.requireOrganise && c.presetType !== 'quarter_peal' && c.presetType !== 'peal');
    
    // Get selected calendar info
    $: selectedCalendar = calendars.find(c => c.id === eventForm.calendarId);
    
    // Set default calendar
    $: if (!eventForm.calendarId && organiseCalendars.length > 0) {
        eventForm.calendarId = organiseCalendars[0].id;
    }
    
    // Auto-set end time based on calendar type when start time changes
    function updateEndTimeFromStart() {
        if (!eventForm.startTime || eventForm.allDay) return;
        
        const presetType = selectedCalendar?.presetType;
        let hoursToAdd = 0;
        
        if (presetType === 'quarter_peal') {
            hoursToAdd = 1; // 1 hour for quarter peals
        } else if (presetType === 'peal') {
            hoursToAdd = 3; // 3 hours for peals
        }
        
        if (hoursToAdd > 0) {
            const [hours, minutes] = eventForm.startTime.split(':').map(Number);
            const endHours = (hours + hoursToAdd) % 24;
            eventForm.endTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            
            // If end time wraps to next day, set end date to next day
            if (hours + hoursToAdd >= 24 && eventForm.startDate) {
                const nextDay = new Date(eventForm.startDate);
                nextDay.setDate(nextDay.getDate() + 1);
                eventForm.endDate = nextDay.toISOString().split('T')[0];
            } else if (eventForm.startDate && !eventForm.endDate) {
                eventForm.endDate = eventForm.startDate;
            }
        }
    }
    
    async function searchTowers(query) {
        if (!query || query.trim().length < 2) {
            towerResults = [];
            return;
        }
        
        searchingTowers = true;
        try {
            const response = await fetch(`/api/search-towers?q=${encodeURIComponent(query)}`);
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
    
    function addInvitedUser(user) {
        if (!invitedUsers.find(u => u.id === user.id)) {
            // Don't add self
            if (user.id === data.user.id) {
                return;
            }
            invitedUsers = [...invitedUsers, user];
        }
    }
    
    function removeInvitedUser(userId) {
        invitedUsers = invitedUsers.filter(u => u.id !== userId);
    }
    
    async function submitEvent() {
        errorMessage = '';
        
        if (!eventForm.calendarId) {
            errorMessage = 'Please select a calendar';
            return;
        }
        
        if (!eventForm.title.trim()) {
            errorMessage = 'Please enter an event title';
            return;
        }
        
        if (!eventForm.startDate) {
            errorMessage = 'Please select a start date';
            return;
        }
        
        isSubmitting = true;
        
        try {
            // Combine date and time
            let startDateTime = eventForm.startDate;
            if (!eventForm.allDay && eventForm.startTime) {
                startDateTime += 'T' + eventForm.startTime;
            }
            
            let endDateTime = eventForm.endDate || eventForm.startDate;
            if (!eventForm.allDay && eventForm.endTime) {
                endDateTime += 'T' + eventForm.endTime;
            }
            
            // Create the event
            const eventResponse = await fetch('/api/calendar-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    calendarId: eventForm.calendarId,
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
                })
            });
            
            if (!eventResponse.ok) {
                throw new Error('Failed to create event');
            }
            
            const newEvent = await eventResponse.json();
            
            // Send invitations
            if (invitedUsers.length > 0) {
                const inviteResponse = await fetch('/api/calendar-events/' + newEvent.id + '/invitations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userIds: invitedUsers.map(u => u.id)
                    })
                });
                
                if (!inviteResponse.ok) {
                    console.error('Failed to send some invitations');
                }
            }
            
            // Reset form
            eventForm = {
                calendarId: organiseCalendars.length > 0 ? organiseCalendars[0].id : '',
                title: '',
                description: '',
                location: '',
                towerID: null,
                startDate: '',
                startTime: '',
                endDate: '',
                endTime: '',
                allDay: false,
                recurrenceType: 'none',
                recurrenceInterval: 1,
                recurrenceEndDate: ''
            };
            invitedUsers = [];
            selectedTower = null;
            towerSearch = '';
            
            showSuccess = true;
            setTimeout(() => {
                showSuccess = false;
            }, 3000);
            
        } catch (error) {
            console.error('Error creating event:', error);
            errorMessage = 'Failed to create event. Please try again.';
        } finally {
            isSubmitting = false;
        }
    }
    
    async function respondToInvitation(invitationId, status) {
        try {
            const response = await fetch('/api/calendar-events/invitations/' + invitationId, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            
            if (response.ok) {
                // Update local state
                const idx = invitations.findIndex(i => i.invitationId === invitationId);
                if (idx !== -1) {
                    invitations[idx].status = status;
                    invitations = [...invitations];
                }
            }
        } catch (error) {
            console.error('Error responding to invitation:', error);
        }
    }
    
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short',
            year: 'numeric'
        });
    }
    
    function formatTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
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
                    const date = new Date(startDate);
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
            const end = new Date(endDate);
            desc += ` until ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
        
        return desc;
    }
    
    function openEditModal(event) {
        editingEvent = event;
        const start = new Date(event.startDate);
        const end = event.endDate ? new Date(event.endDate) : start;
        
        editForm = {
            title: event.title,
            description: event.description || '',
            location: event.location || '',
            startDate: start.toISOString().slice(0, 10),
            startTime: start.toTimeString().slice(0, 5),
            endDate: end.toISOString().slice(0, 10),
            endTime: end.toTimeString().slice(0, 5),
            allDay: event.allDay || false,
            recurrenceType: event.recurrenceType || 'none',
            recurrenceInterval: event.recurrenceInterval || 1,
            recurrenceEndDate: event.recurrenceEndDate ? new Date(event.recurrenceEndDate).toISOString().slice(0, 10) : ''
        };
        showEditModal = true;
    }
    
    function closeEditModal() {
        showEditModal = false;
        editingEvent = null;
    }
    
    async function saveEventChanges() {
        if (!editingEvent) return;
        
        isSubmitting = true;
        try {
            let startDateTime = editForm.startDate;
            if (!editForm.allDay && editForm.startTime) {
                startDateTime += 'T' + editForm.startTime;
            }
            
            let endDateTime = editForm.endDate || editForm.startDate;
            if (!editForm.allDay && editForm.endTime) {
                endDateTime += 'T' + editForm.endTime;
            }
            
            const response = await fetch('/api/calendar-events/' + editingEvent.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editForm.title,
                    description: editForm.description,
                    location: editForm.location,
                    startDate: startDateTime,
                    endDate: endDateTime,
                    allDay: editForm.allDay,
                    recurrenceType: editForm.recurrenceType,
                    recurrenceInterval: editForm.recurrenceInterval,
                    recurrenceEndDate: editForm.recurrenceEndDate || null
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update event');
            }
            
            // Update local state
            const idx = recentEvents.findIndex(e => e.id === editingEvent.id);
            if (idx !== -1) {
                recentEvents[idx] = {
                    ...recentEvents[idx],
                    title: editForm.title,
                    description: editForm.description,
                    location: editForm.location,
                    startDate: startDateTime,
                    endDate: endDateTime,
                    allDay: editForm.allDay,
                    recurrenceType: editForm.recurrenceType,
                    recurrenceInterval: editForm.recurrenceInterval,
                    recurrenceEndDate: editForm.recurrenceEndDate
                };
                recentEvents = [...recentEvents];
            }
            
            closeEditModal();
            showSuccess = true;
            setTimeout(() => showSuccess = false, 3000);
        } catch (error) {
            console.error('Error updating event:', error);
            errorMessage = 'Failed to update event. Please try again.';
        } finally {
            isSubmitting = false;
        }
    }
    
    async function deleteEvent(event) {
        if (!confirm(`Are you sure you want to delete "${event.title}"? This will also remove it from all invited users' calendars.`)) {
            return;
        }
        
        try {
            const response = await fetch('/api/calendar-events/' + event.id, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete event');
            }
            
            // Remove from local state
            recentEvents = recentEvents.filter(e => e.id !== event.id);
            
            if (showEditModal && editingEvent?.id === event.id) {
                closeEditModal();
            }
        } catch (error) {
            console.error('Error deleting event:', error);
            errorMessage = 'Failed to delete event. Please try again.';
        }
    }
</script>

<svelte:head>
    <title>Organise Ringing - TowerTrack</title>
</svelte:head>

<Header user={data.user} />

<main class="section">
<div class="container">
    <h1 class="title is-2">Organise Ringing</h1>
    <p class="subtitle">Plan and organise peals, quarter peals, and other ringing events</p>
    
    <!-- Tabs -->
    <div class="tabs is-boxed">
        <ul>
            <li class:is-active={activeTab === 'create'}>
                <button class="tab-button" on:click={() => activeTab = 'create'}>
                    <span class="icon"><i class="fas fa-plus"></i></span>
                    <span>Create Event</span>
                </button>
            </li>
            <li class:is-active={activeTab === 'upcoming'}>
                <button class="tab-button" on:click={() => activeTab = 'upcoming'}>
                    <span class="icon"><i class="fas fa-calendar-alt"></i></span>
                    <span>My Events</span>
                    {#if recentEvents.length > 0}
                        <span class="tag is-info is-rounded ml-2">{recentEvents.length}</span>
                    {/if}
                </button>
            </li>
            <li class:is-active={activeTab === 'invitations'}>
                <button class="tab-button" on:click={() => activeTab = 'invitations'}>
                    <span class="icon"><i class="fas fa-envelope"></i></span>
                    <span>Invitations</span>
                    {#if invitations.filter(i => i.status === 'pending').length > 0}
                        <span class="tag is-warning is-rounded ml-2">{invitations.filter(i => i.status === 'pending').length}</span>
                    {/if}
                </button>
            </li>
        </ul>
    </div>
    
    <!-- Create Event Tab -->
    {#if activeTab === 'create'}
        <div class="box">
            {#if showSuccess}
                <div class="notification is-success">
                    <button class="delete" on:click={() => showSuccess = false}></button>
                    Event created successfully! Invitations have been sent.
                </div>
            {/if}
            
            {#if errorMessage}
                <div class="notification is-danger">
                    <button class="delete" on:click={() => errorMessage = ''}></button>
                    {errorMessage}
                </div>
            {/if}
            
            <div class="columns">
                <div class="column is-7">
                    <h2 class="title is-4">Event Details</h2>
                    
                    <!-- Calendar Selection -->
                    <div class="field">
                        <label class="label" for="calendar-select">Calendar</label>
                        <div class="control">
                            <div class="select is-fullwidth">
                                <select id="calendar-select" bind:value={eventForm.calendarId}>
                                    {#if organiseCalendars.length > 0}
                                        <optgroup label="Organised Events">
                                            {#each organiseCalendars as calendar}
                                                <option value={calendar.id}>
                                                    {calendar.name}
                                                    {#if calendar.requireOrganise}(required){/if}
                                                </option>
                                            {/each}
                                        </optgroup>
                                    {/if}
                                    {#if otherCalendars.length > 0}
                                        <optgroup label="Other Calendars">
                                            {#each otherCalendars as calendar}
                                                <option value={calendar.id}>{calendar.name}</option>
                                            {/each}
                                        </optgroup>
                                    {/if}
                                </select>
                            </div>
                        </div>
                        <p class="help">Quarter Peal and Peal calendars require the organise feature</p>
                    </div>
                    
                    <!-- Event Title -->
                    <div class="field">
                        <label class="label" for="event-title">Event Title</label>
                        <div class="control">
                            <input 
                                id="event-title"
                                class="input" 
                                type="text" 
                                placeholder="e.g., Quarter Peal of Plain Bob Minor"
                                bind:value={eventForm.title}
                            />
                        </div>
                    </div>
                    
                    <!-- Tower Selection -->
                    <div class="field">
                        <label class="label" for="tower-search">Tower</label>
                        <div class="control has-icons-right">
                            {#if selectedTower}
                                <div class="selected-tower">
                                    <span class="tag is-medium is-info">
                                        {selectedTower.Place}, {selectedTower.Dedicn}
                                        <button class="delete is-small" on:click={clearTower}></button>
                                    </span>
                                </div>
                            {:else}
                                <input 
                                    id="tower-search"
                                    class="input" 
                                    type="text" 
                                    placeholder="Search for a tower..."
                                    bind:value={towerSearch}
                                    on:input={(e) => searchTowers(e.target.value)}
                                />
                                {#if searchingTowers}
                                    <span class="icon is-right">
                                        <i class="fas fa-spinner fa-spin"></i>
                                    </span>
                                {/if}
                            {/if}
                        </div>
                        
                        {#if towerResults.length > 0}
                            <div class="tower-results">
                                {#each towerResults as tower}
                                    <button 
                                        type="button"
                                        class="tower-result"
                                        on:click={() => selectTower(tower)}
                                    >
                                        <strong>{tower.Place}</strong>, {tower.Dedicn}
                                        <span class="has-text-grey-light">({tower.Bells} bells)</span>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                    
                    <!-- Date and Time -->
                    <div class="field">
                        <label class="checkbox">
                            <input type="checkbox" bind:checked={eventForm.allDay} />
                            All day event
                        </label>
                    </div>
                    
                    <div class="columns">
                        <div class="column">
                            <div class="field">
                                <label class="label" for="start-date">Start Date</label>
                                <div class="control">
                                    <input 
                                        id="start-date"
                                        class="input" 
                                        type="date" 
                                        bind:value={eventForm.startDate}
                                    />
                                </div>
                            </div>
                        </div>
                        {#if !eventForm.allDay}
                            <div class="column">
                                <div class="field">
                                    <label class="label" for="start-time">Start Time</label>
                                    <div class="control">
                                        <input 
                                            id="start-time"
                                            class="input" 
                                            type="time" 
                                            bind:value={eventForm.startTime}
                                            on:change={updateEndTimeFromStart}
                                        />
                                    </div>
                                    {#if selectedCalendar?.presetType === 'quarter_peal'}
                                        <p class="help">End time will default to 1 hour later</p>
                                    {:else if selectedCalendar?.presetType === 'peal'}
                                        <p class="help">End time will default to 3 hours later</p>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    </div>
                    
                    <div class="columns">
                        <div class="column">
                            <div class="field">
                                <label class="label" for="end-date">End Date</label>
                                <div class="control">
                                    <input 
                                        id="end-date"
                                        class="input" 
                                        type="date" 
                                        bind:value={eventForm.endDate}
                                    />
                                </div>
                            </div>
                        </div>
                        {#if !eventForm.allDay}
                            <div class="column">
                                <div class="field">
                                    <label class="label" for="end-time">End Time</label>
                                    <div class="control">
                                        <input 
                                            id="end-time"
                                            class="input" 
                                            type="time" 
                                            bind:value={eventForm.endTime}
                                        />
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                    
                    <!-- Recurrence -->
                    <div class="field">
                        <label class="label">Repeat</label>
                        <div class="control">
                            <div class="select is-fullwidth">
                                <select bind:value={eventForm.recurrenceType}>
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
                                <span class="icon"><i class="fas fa-repeat"></i></span>
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
                                            placeholder="No end date"
                                        />
                                    </div>
                                    <p class="help">Leave empty for no end date</p>
                                </div>
                            </div>
                        </div>
                    {/if}
                    
                    <!-- Notes -->
                    <div class="field">
                        <label class="label" for="description">Notes</label>
                        <div class="control">
                            <textarea 
                                id="description"
                                class="textarea" 
                                placeholder="Additional notes about the event..."
                                bind:value={eventForm.description}
                                rows="3"
                            ></textarea>
                        </div>
                    </div>
                </div>
                
                <div class="column is-5">
                    <h2 class="title is-4">Invite Ringers</h2>
                    
                    <UserSearch 
                        showAddButton={true}
                        onUserSelect={addInvitedUser}
                        maxHeight="200px"
                    />
                    
                    {#if invitedUsers.length > 0}
                        <div class="invited-users mt-4">
                            <p class="has-text-weight-semibold mb-2">Invited ({invitedUsers.length}):</p>
                            <div class="tags">
                                {#each invitedUsers as invitedUser}
                                    <span class="tag is-medium is-primary">
                                        {#if invitedUser.profileImage}
                                            <img 
                                                src="/uploads/profiles/{invitedUser.profileImage}" 
                                                alt="" 
                                                class="invited-avatar"
                                            />
                                        {/if}
                                        {invitedUser.username}
                                        <button 
                                            class="delete is-small" 
                                            on:click={() => removeInvitedUser(invitedUser.id)}
                                        ></button>
                                    </span>
                                {/each}
                            </div>
                        </div>
                    {:else}
                        <p class="help has-text-grey mt-3">
                            Search for users above to invite them to this event.
                        </p>
                    {/if}
                </div>
            </div>
            
            <hr />
            
            <div class="field is-grouped is-grouped-right">
                <div class="control">
                    <button 
                        class="button is-primary is-medium"
                        class:is-loading={isSubmitting}
                        on:click={submitEvent}
                        disabled={isSubmitting}
                    >
                        <span class="icon"><i class="fas fa-calendar-check"></i></span>
                        <span>Create Event</span>
                    </button>
                </div>
            </div>
        </div>
    {/if}
    
    <!-- My Events Tab -->
    {#if activeTab === 'upcoming'}
        <div class="box">
            <h2 class="title is-4">Upcoming Events</h2>
            
            {#if recentEvents.length === 0}
                <div class="has-text-centered py-5">
                    <p class="has-text-grey">No upcoming events organised by you.</p>
                    <button class="button is-primary mt-3" on:click={() => activeTab = 'create'}>
                        Create your first event
                    </button>
                </div>
            {:else}
                <div class="event-list">
                    {#each recentEvents as event}
                        <div class="event-card">
                            <div class="event-date-badge" style="background-color: {event.calendarColour}">
                                <span class="event-day">{new Date(event.startDate).getDate()}</span>
                                <span class="event-month">{new Date(event.startDate).toLocaleDateString('en-GB', { month: 'short' })}</span>
                            </div>
                            <div class="event-details">
                                <h3 class="title is-5 mb-1">{event.title}</h3>
                                <p class="subtitle is-6 mb-2">
                                    <span class="icon-text">
                                        <span class="icon"><i class="fas fa-folder"></i></span>
                                        <span>{event.calendarName}</span>
                                    </span>
                                </p>
                                {#if event.towerPlace}
                                    <p class="has-text-grey">
                                        <span class="icon"><i class="fas fa-church"></i></span>
                                        {event.towerPlace}, {event.towerDedication}
                                    </p>
                                {/if}
                                {#if !event.allDay}
                                    <p class="has-text-grey">
                                        <span class="icon"><i class="fas fa-clock"></i></span>
                                        {formatTime(event.startDate)}
                                        {#if event.endDate}
                                            - {formatTime(event.endDate)}
                                        {/if}
                                    </p>
                                {/if}
                                {#if event.recurrenceType && event.recurrenceType !== 'none'}
                                    <p class="has-text-info is-size-7">
                                        <span class="icon"><i class="fas fa-repeat"></i></span>
                                        {getRecurrenceDescription(event.recurrenceType, event.recurrenceInterval, event.recurrenceEndDate, event.startDate)}
                                    </p>
                                {/if}
                            </div>
                            <div class="event-actions">
                                {#if event.recurrenceType && event.recurrenceType !== 'none'}
                                    <span class="tag is-info is-light mr-2" title="Recurring event">
                                        <span class="icon"><i class="fas fa-repeat"></i></span>
                                    </span>
                                {/if}
                                {#if event.invitationCount > 0}
                                    <span class="tag is-light mr-2">
                                        <span class="icon"><i class="fas fa-users"></i></span>
                                        <span>{event.acceptedCount}/{event.invitationCount}</span>
                                    </span>
                                {/if}
                                <div class="buttons are-small">
                                    <button 
                                        class="button is-info is-outlined"
                                        on:click={() => openEditModal(event)}
                                        title="Edit event"
                                    >
                                        <span class="icon"><i class="fas fa-edit"></i></span>
                                    </button>
                                    <button 
                                        class="button is-danger is-outlined"
                                        on:click={() => deleteEvent(event)}
                                        title="Delete event"
                                    >
                                        <span class="icon"><i class="fas fa-trash"></i></span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
    
    <!-- Invitations Tab -->
    {#if activeTab === 'invitations'}
        <div class="box">
            <h2 class="title is-4">Event Invitations</h2>
            
            {#if invitations.length === 0}
                <div class="has-text-centered py-5">
                    <p class="has-text-grey">No event invitations.</p>
                </div>
            {:else}
                <div class="event-list">
                    {#each invitations as invitation}
                        <div class="event-card invitation-card" class:pending={invitation.status === 'pending'} class:accepted={invitation.status === 'accepted'} class:declined={invitation.status === 'declined'}>
                            <div class="event-date-badge" style="background-color: {invitation.calendarColour}">
                                <span class="event-day">{new Date(invitation.startDate).getDate()}</span>
                                <span class="event-month">{new Date(invitation.startDate).toLocaleDateString('en-GB', { month: 'short' })}</span>
                            </div>
                            <div class="event-details">
                                <h3 class="title is-5 mb-1">{invitation.title}</h3>
                                <p class="subtitle is-6 mb-2">
                                    <span class="icon-text">
                                        <span class="icon"><i class="fas fa-user"></i></span>
                                        <span>Organised by <a href="/u/{invitation.organiserUsername.replace(/ /g, '-')}">{invitation.organiserUsername}</a></span>
                                    </span>
                                </p>
                                {#if invitation.towerPlace}
                                    <p class="has-text-grey">
                                        <span class="icon"><i class="fas fa-church"></i></span>
                                        {invitation.towerPlace}, {invitation.towerDedication}
                                    </p>
                                {/if}
                                <p class="has-text-grey">
                                    <span class="icon"><i class="fas fa-calendar"></i></span>
                                    {formatDate(invitation.startDate)}
                                    {#if !invitation.allDay}
                                        at {formatTime(invitation.startDate)}
                                    {/if}
                                </p>
                            </div>
                            <div class="invitation-actions">
                                {#if invitation.status === 'pending'}
                                    <div class="buttons">
                                        <button 
                                            class="button is-success is-small"
                                            on:click={() => respondToInvitation(invitation.invitationId, 'accepted')}
                                        >
                                            <span class="icon"><i class="fas fa-check"></i></span>
                                            <span>Accept</span>
                                        </button>
                                        <button 
                                            class="button is-warning is-small"
                                            on:click={() => respondToInvitation(invitation.invitationId, 'maybe')}
                                        >
                                            <span class="icon"><i class="fas fa-question"></i></span>
                                            <span>Maybe</span>
                                        </button>
                                        <button 
                                            class="button is-danger is-small is-outlined"
                                            on:click={() => respondToInvitation(invitation.invitationId, 'declined')}
                                        >
                                            <span class="icon"><i class="fas fa-times"></i></span>
                                            <span>Decline</span>
                                        </button>
                                    </div>
                                {:else}
                                    <span class="tag is-medium" class:is-success={invitation.status === 'accepted'} class:is-warning={invitation.status === 'maybe'} class:is-danger={invitation.status === 'declined'}>
                                        {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                                    </span>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>
</main>

<!-- Edit Event Modal -->
{#if showEditModal && editingEvent}
    <div class="modal is-active">
        <div class="modal-background" on:click={closeEditModal} on:keydown={(e) => e.key === 'Escape' && closeEditModal()} role="button" tabindex="0" aria-label="Close modal"></div>
        <div class="modal-card">
            <header class="modal-card-head">
                <p class="modal-card-title">Edit Event</p>
                <button class="delete" aria-label="close" on:click={closeEditModal}></button>
            </header>
            <section class="modal-card-body">
                {#if errorMessage}
                    <div class="notification is-danger">
                        <button class="delete" on:click={() => errorMessage = ''}></button>
                        {errorMessage}
                    </div>
                {/if}
                
                <div class="field">
                    <label class="label" for="edit-title">Title</label>
                    <div class="control">
                        <input id="edit-title" class="input" type="text" bind:value={editForm.title} placeholder="Event title" />
                    </div>
                </div>
                
                <div class="field">
                    <label class="checkbox">
                        <input type="checkbox" bind:checked={editForm.allDay} />
                        All day event
                    </label>
                </div>
                
                <div class="columns">
                    <div class="column">
                        <div class="field">
                            <label class="label" for="edit-start-date">Start Date</label>
                            <div class="control">
                                <input id="edit-start-date" class="input" type="date" bind:value={editForm.startDate} />
                            </div>
                        </div>
                    </div>
                    {#if !editForm.allDay}
                        <div class="column">
                            <div class="field">
                                <label class="label" for="edit-start-time">Start Time</label>
                                <div class="control">
                                    <input id="edit-start-time" class="input" type="time" bind:value={editForm.startTime} />
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
                
                <div class="columns">
                    <div class="column">
                        <div class="field">
                            <label class="label" for="edit-end-date">End Date</label>
                            <div class="control">
                                <input id="edit-end-date" class="input" type="date" bind:value={editForm.endDate} />
                            </div>
                        </div>
                    </div>
                    {#if !editForm.allDay}
                        <div class="column">
                            <div class="field">
                                <label class="label" for="edit-end-time">End Time</label>
                                <div class="control">
                                    <input id="edit-end-time" class="input" type="time" bind:value={editForm.endTime} />
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
                
                <div class="field">
                    <label class="label" for="edit-location">Location</label>
                    <div class="control">
                        <input id="edit-location" class="input" type="text" bind:value={editForm.location} placeholder="Location" />
                    </div>
                    {#if editingEvent.towerPlace}
                        <p class="help">
                            <span class="icon"><i class="fas fa-church"></i></span>
                            Tower: {editingEvent.towerPlace}, {editingEvent.towerDedication}
                        </p>
                    {/if}
                </div>
                
                <!-- Recurrence in edit modal -->
                <div class="field">
                    <label class="label">Repeat</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select bind:value={editForm.recurrenceType}>
                                <option value="none">Does not repeat</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly (same date)</option>
                                <option value="monthly_nth">Monthly (same weekday)</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </div>
                    </div>
                    {#if editForm.recurrenceType !== 'none'}
                        <p class="help has-text-info">
                            <span class="icon"><i class="fas fa-repeat"></i></span>
                            {getRecurrenceDescription(editForm.recurrenceType, editForm.recurrenceInterval, editForm.recurrenceEndDate, editForm.startDate)}
                        </p>
                    {/if}
                </div>
                
                {#if editForm.recurrenceType !== 'none'}
                    <div class="columns">
                        <div class="column">
                            <div class="field">
                                <label class="label" for="edit-recurrence-interval">Every</label>
                                <div class="field has-addons">
                                    <div class="control">
                                        <input 
                                            id="edit-recurrence-interval"
                                            class="input" 
                                            type="number" 
                                            min="1" 
                                            max="99"
                                            bind:value={editForm.recurrenceInterval}
                                        />
                                    </div>
                                    <div class="control">
                                        <span class="button is-static">
                                            {#if editForm.recurrenceType === 'daily'}day(s)
                                            {:else if editForm.recurrenceType === 'weekly'}week(s)
                                            {:else if editForm.recurrenceType === 'monthly' || editForm.recurrenceType === 'monthly_nth'}month(s)
                                            {:else if editForm.recurrenceType === 'yearly'}year(s)
                                            {/if}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="column">
                            <div class="field">
                                <label class="label" for="edit-recurrence-end">Until (optional)</label>
                                <div class="control">
                                    <input 
                                        id="edit-recurrence-end"
                                        class="input" 
                                        type="date" 
                                        bind:value={editForm.recurrenceEndDate}
                                    />
                                </div>
                                <p class="help">Leave empty for no end date</p>
                            </div>
                        </div>
                    </div>
                {/if}
                
                <div class="field">
                    <label class="label" for="edit-description">Notes</label>
                    <div class="control">
                        <textarea id="edit-description" class="textarea" bind:value={editForm.description} placeholder="Additional notes..." rows="3"></textarea>
                    </div>
                </div>
                
                {#if editingEvent.invitationCount > 0}
                    <div class="notification is-info is-light">
                        <span class="icon"><i class="fas fa-info-circle"></i></span>
                        Changes will be automatically applied to all {editingEvent.invitationCount} invited users' calendars.
                    </div>
                {/if}
            </section>
            <footer class="modal-card-foot">
                <button 
                    class="button is-primary" 
                    on:click={saveEventChanges}
                    class:is-loading={isSubmitting}
                    disabled={isSubmitting}
                >
                    Save Changes
                </button>
                <button 
                    class="button is-danger is-outlined" 
                    on:click={() => deleteEvent(editingEvent)}
                >
                    Delete Event
                </button>
                <button class="button" on:click={closeEditModal}>Cancel</button>
            </footer>
        </div>
    </div>
{/if}

<Footer />

<style>
    .tab-button {
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5em 1em;
        font-size: 1rem;
        color: inherit;
    }
    
    .tabs li.is-active .tab-button {
        color: #3273dc;
    }
    
    .tower-results {
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-top: 0.25rem;
        max-height: 200px;
        overflow-y: auto;
    }
    
    .tower-result {
        display: block;
        width: 100%;
        padding: 0.5rem 0.75rem;
        text-align: left;
        border: none;
        background: none;
        cursor: pointer;
        border-bottom: 1px solid #eee;
    }
    
    .tower-result:last-child {
        border-bottom: none;
    }
    
    .tower-result:hover {
        background-color: #f5f5f5;
    }
    
    .selected-tower {
        padding: 0.5rem 0;
    }
    
    .invited-users .tag {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .invited-avatar {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        object-fit: cover;
    }
    
    .event-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    
    .event-card {
        display: flex;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid #ddd;
        border-radius: 8px;
        align-items: flex-start;
    }
    
    .event-date-badge {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 60px;
        padding: 0.5rem;
        border-radius: 8px;
        color: white;
        text-align: center;
    }
    
    .event-day {
        font-size: 1.5rem;
        font-weight: bold;
        line-height: 1;
    }
    
    .event-month {
        font-size: 0.75rem;
        text-transform: uppercase;
    }
    
    .event-details {
        flex: 1;
    }
    
    .event-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    
    .event-actions .buttons {
        margin-bottom: 0;
    }
    
    .event-stats,
    .invitation-actions {
        display: flex;
        align-items: center;
    }
    
    .invitation-card.pending {
        border-color: #f59e0b;
        background-color: rgba(245, 158, 11, 0.05);
    }
    
    .invitation-card.accepted {
        border-color: #22c55e;
        background-color: rgba(34, 197, 94, 0.05);
    }
    
    .invitation-card.declined {
        border-color: #ef4444;
        background-color: rgba(239, 68, 68, 0.05);
    }
    
    @media (prefers-color-scheme: dark) {
        .tower-results {
            border-color: #3b3f45;
        }
        
        .tower-result {
            border-bottom-color: #3b3f45;
        }
        
        .tower-result:hover {
            background-color: #2c2f33;
        }
        
        .event-card {
            border-color: #3b3f45;
        }
        
        .invitation-card.pending {
            border-color: #b45309;
            background-color: rgba(245, 158, 11, 0.1);
        }
        
        .invitation-card.accepted {
            border-color: #16a34a;
            background-color: rgba(34, 197, 94, 0.1);
        }
        
        .invitation-card.declined {
            border-color: #dc2626;
            background-color: rgba(239, 68, 68, 0.1);
        }
    }
    
    @media screen and (max-width: 768px) {
        .event-card {
            flex-wrap: wrap;
        }
        
        .event-actions,
        .event-stats,
        .invitation-actions {
            width: 100%;
            margin-top: 0.5rem;
            justify-content: flex-start;
        }
        
        .invitation-actions .buttons {
            flex-wrap: wrap;
        }
    }
</style>
