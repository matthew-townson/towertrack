<script>
    import { enhance } from '$app/forms';
    export let data;
    export let form;
    
    let expandedUser = null;
    
    function toggleUserDetails(userId) {
        expandedUser = expandedUser === userId ? null : userId;
    }
    
    function getPermissionLabel(permission) {
        switch(permission) {
            case 0: return 'Admin';
            case 1: return 'Moderator';
            case 2: return 'Verified User';
            case 3: return 'Unverified User';
            case 4: return 'Banned User';
            default: return 'Unknown';
        }
    }
    
    function getPermissionClass(permission) {
        switch(permission) {
            case 0: return 'admin';
            case 1: return 'moderator';
            case 2: return 'verified';
            case 3: return 'unverified';
            case 4: return 'banned';
            default: return 'unknown';
        }
    }
</script>

<svelte:head>
    <title>User Data | Admin | towertracker</title>
</svelte:head>

<main>
    <h1>User Data</h1>
    
    {#if form?.success}
        <div class="success">
            <h3>✅ Success</h3>
            <p>{form.message}</p>
        </div>
    {/if}
    
    {#if form?.error || data.error}
        <div class="error">
            <h3>❗Error</h3>
            <p>{form?.message || data.error}</p>
        </div>
    {:else}
        <div class="user-stats">
            <p><strong>Total Users:</strong> {data.users.length}</p>
        </div>
        
        <div class="user-table-container">
            <table class="user-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Permission Level</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each data.users as user}
                        <tr>
                            <td>{user.id}</td>
                            <td>{user.username}</td>
                            <td>{user.email}</td>
                            <td>
                                <span class="permission-badge {getPermissionClass(user.permission)}">
                                    {getPermissionLabel(user.permission)} ({user.permission})
                                </span>
                            </td>
                            <td>
                                {#if user.id === data.user.id}
                                    <span class="self-user">Cannot modify own permissions</span>
                                {:else}
                                    <div class="action-buttons">
                                        <form method="POST" action="?/updatePermission" use:enhance class="permission-form">
                                            <input type="hidden" name="userId" value={user.id} />
                                            <select name="permission" class="permission-select">
                                                <option value="0" selected={user.permission === 0}>Admin (0)</option>
                                                <option value="1" selected={user.permission === 1}>Moderator (1)</option>
                                                <option value="2" selected={user.permission === 2}>Verified User (2)</option>
                                                <option value="3" selected={user.permission === 3}>Unverified User (3)</option>
                                                <option value="4" selected={user.permission === 4}>Banned User (4)</option>
                                            </select>
                                            <button type="submit" class="update-btn">Update</button>
                                        </form>
                                        <button type="button" class="expand-btn" on:click={() => toggleUserDetails(user.id)}>
                                            {expandedUser === user.id ? 'Hide Details' : 'Edit Details'}
                                        </button>
                                    </div>
                                {/if}
                            </td>
                        </tr>
                        {#if expandedUser === user.id}
                            <tr class="expanded-row">
                                <td colspan="5">
                                    <div class="user-details">
                                        <h4>Edit User Details</h4>
                                        <div class="detail-forms">
                                            <form method="POST" action="?/updateUsername" use:enhance class="detail-form">
                                                <input type="hidden" name="userId" value={user.id} />
                                                <label for="username-{user.id}">Username:</label>
                                                <input type="text" id="username-{user.id}" name="username" value={user.username} required />
                                                <button type="submit" class="detail-btn">Update Username</button>
                                            </form>
                                            
                                            <form method="POST" action="?/updateEmail" use:enhance class="detail-form">
                                                <input type="hidden" name="userId" value={user.id} />
                                                <label for="email-{user.id}">Email:</label>
                                                <input type="email" id="email-{user.id}" name="email" value={user.email} required />
                                                <button type="submit" class="detail-btn">Update Email</button>
                                            </form>
                                            
                                            <form method="POST" action="?/updatePassword" use:enhance class="detail-form">
                                                <input type="hidden" name="userId" value={user.id} />
                                                <label for="password-{user.id}">New Password:</label>
                                                <input type="password" id="password-{user.id}" name="password" placeholder="Enter new password" required />
                                                <button type="submit" class="detail-btn">Update Password</button>
                                            </form>
                                            
                                            <form method="POST" action="?/deleteUser" use:enhance class="detail-form delete-form">
                                                <input type="hidden" name="userId" value={user.id} />
                                                <label for="delete">Delete User:</label>
                                                <p class="warning-text">This action cannot be undone!</p>
                                                <button type="submit" class="delete-btn" on:click={(e) => {
                                                    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                                                        e.preventDefault();
                                                    }
                                                }}>Delete User</button>
                                            </form>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        {/if}
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</main>
