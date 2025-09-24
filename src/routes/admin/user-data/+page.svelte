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
    
    function getPrivacyLabel(visibility) {
        return visibility ? 'Public' : 'Private';
    }
    
    function getPrivacyClass(visibility) {
        return visibility ? 'verified' : 'unverified';
    }
</script>

<svelte:head>
    <title>User Data | towertracker</title>
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
                        <th>Privacy Settings</th>
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
                                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <span class="permission-badge {getPrivacyClass(user.profileVisibility)}">
                                        Profile: {getPrivacyLabel(user.profileVisibility)}
                                    </span>
                                    <span class="permission-badge {getPrivacyClass(user.dataVisibility)}">
                                        Data: {getPrivacyLabel(user.dataVisibility)}
                                    </span>
                                </div>
                            </td>
                            <td>
                                {#if user.id === data.user.id}
                                    <span class="self-user">Cannot modify own settings</span>
                                    <div class="action-buttons">
                                        <button type="button" class="expand-btn" on:click={() => toggleUserDetails(user.id)}>
                                            {expandedUser === user.id ? 'Hide Details' : 'Edit Details'}
                                        </button>
                                    </div>
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
                                        <form method="POST" action="?/updatePrivacySettings" use:enhance class="permission-form">
                                            <input type="hidden" name="userId" value={user.id} />
                                            <select name="profileVisibility" class="permission-select">
                                                <option value="1" selected={user.profileVisibility}>Profile: Public</option>
                                                <option value="0" selected={!user.profileVisibility}>Profile: Private</option>
                                            </select>
                                            <select name="dataVisibility" class="permission-select">
                                                <option value="1" selected={user.dataVisibility}>Data: Visible</option>
                                                <option value="0" selected={!user.dataVisibility}>Data: Hidden</option>
                                            </select>
                                            <button type="submit" class="update-btn">Update Privacy</button>
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
                                <td colspan="6">
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

<style>
  main {
    padding: 1rem;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    color: #f3f4f6;
    background: #14161a;
  }

  h1 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    color: #f3f4f6;
  }

  .user-stats {
    margin-bottom: 1rem;
    color: #cbd5e1;
  }

  .user-table-container {
    overflow-x: auto;
    background: #23262b;
    border-radius: 0.5rem;
    border: 1px solid rgba(255,255,255,0.03);
    padding: 0.5rem;
  }

  .user-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 720px;
    color: #f3f4f6;
  }

  .user-table th,
  .user-table td {
    padding: 0.65rem 0.75rem;
    text-align: left;
    vertical-align: middle;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    font-size: 0.95rem;
  }

  .user-table thead th {
    background: rgba(255,255,255,0.02);
    color: #8ee3ef;
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .permission-badge {
    display: inline-block;
    padding: 0.22rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.82rem;
    color: #071023;
    line-height: 1;
    font-weight: 600;
    text-transform: none;
  }

  .permission-badge.admin { background: #8b5cf6; }       /* purple */
  .permission-badge.moderator { background: #3b82f6; }   /* blue */
  .permission-badge.verified { background: #10b981; }    /* green */
  .permission-badge.unverified { background: #94a3b8; }  /* muted */
  .permission-badge.banned { background: #f97316; }      /* orange/red */
  .permission-badge.unknown { background: #64748b; }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .permission-form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin: 0;
  }

  .permission-select {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    padding: 0.35rem 1.1rem 0.35rem 0.45rem;
    border-radius: 0.375rem;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f3f4f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") no-repeat right 0.5rem center;
    background-size: 0.75rem;
    color: #f3f4f6;
    font-size: 0.9rem;
    cursor: pointer;
    min-width: 8rem;
  }

  .permission-select::-ms-expand { display: none; }

  .permission-select:focus {
    outline: none;
    border-color: #c33c54;
    box-shadow: 0 0 0 4px rgba(195,60,84,0.12);
  }

  .permission-select option {
    background: #23262b;
    color: #f3f4f6;
  }

  .update-btn,
  .expand-btn,
  .detail-btn,
  .delete-btn {
    padding: 0.35rem 0.6rem;
    border-radius: 0.375rem;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.03);
    color: #f3f4f6;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .update-btn { background: #c33c54; color: #fff; border-color: rgba(0,0,0,0.12); }
  .update-btn:hover { background: #a02f44; }

  .expand-btn {
    background: rgba(255,255,255,0.02);
    border-color: rgba(255,255,255,0.04);
  }
  .expand-btn:hover { background: rgba(255,255,255,0.05); }

  .detail-forms {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.5rem;
    align-items: flex-start;
  }

  .detail-form {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 220px;
  }

  .detail-form input[type="text"],
  .detail-form input[type="email"],
  .detail-form input[type="password"] {
    padding: 0.35rem 0.45rem;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 0.35rem;
    font-size: 0.95rem;
    background: rgba(255,255,255,0.02);
    color: #f3f4f6;
  }

  .delete-form {
    margin-left: auto;
    align-self: flex-start;
  }

  .delete-btn {
    background: #bb1f1f;
    color: #fff;
    border-color: rgba(0,0,0,0.2);
  }
  .delete-btn:hover { background: #a91b1b; }

  .warning-text {
    color: #fca5a5;
    margin: 0;
    font-size: 0.88rem;
  }

  .success {
    background: rgba(16,185,129,0.12);
    border: 1px solid rgba(16,185,129,0.28);
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    color: #bbf7d0;
  }

  .error {
    background: rgba(239,68,68,0.09);
    border: 1px solid rgba(239,68,68,0.22);
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    color: #fecaca;
  }

  .self-user {
    font-style: italic;
    color: #94a3b8;
    margin-right: 0.5rem;
    display: inline-block;
  }

  .expanded-row td {
    background: rgba(255,255,255,0.01);
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  @media (max-width: 820px) {
    .user-table { min-width: 640px; }
  }

  @media (max-width: 640px) {
    .user-table { border: 0; min-width: 0; }
    .user-table thead { display: none; }
    .user-table tr { display: block; margin-bottom: 0.6rem; border: 1px solid rgba(255,255,255,0.03); border-radius: 0.5rem; padding: 0.5rem; }
    .user-table td { display: flex; justify-content: space-between; padding: 0.45rem 0.5rem; border: 0; color: #f3f4f6; }
    .permission-form { flex-direction: column; align-items: stretch; gap: 0.45rem; }
    .action-buttons { flex-direction: column; align-items: stretch; }
    .detail-forms { flex-direction: column; }
    .delete-form { margin-left: 0; }
  }
</style>
