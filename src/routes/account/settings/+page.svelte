<script>
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	export let form;
	export let data;
</script>

<svelte:head>
    <title>Settings | towertracker</title>
    <meta name="description" content="Change account settings"/>
</svelte:head>

<Header user={data.user} />

<main>
    <h1>Settings</h1>
    <form class="login-box" method="post">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" placeholder="Enter your name as it appears on BellBoard" value={data.user?.username ?? ''} autocomplete="off" required />
        <div class="info">
            <p>Multiple names are not currently supported, this will change in the future</p>
        </div>  
        <label for="email">Email</label>
        <input type="email" id="email" name="email" placeholder="Enter your email address" value={data.user?.email ?? ''} autocomplete="off" required />
        <br>
        
        <h2>Change Password</h2>
        <label for="currentPassword">Current Password</label>
        <input type="password" id="currentPassword" name="currentPassword" placeholder="Enter your current password" autocomplete="off" />
        <br>
        <label for="newPassword">New Password</label>
        <input type="password" id="newPassword" name="newPassword" placeholder="8 character minimum (At least one letter and one number)" autocomplete="off" />
        <br>
        <label for="confirmNewPassword">Confirm New Password</label>
        <input type="password" id="confirmNewPassword" name="confirmNewPassword" placeholder="Confirm your new password" autocomplete="off" />
        <div class="info">
            <p>Leave password fields blank if you don't want to change your password</p>
        </div>
        <br>
        
        <button type="submit">Save Changes</button>
        <br>
        {#if form?.error}
            <div class="error">
                <h3>❗Error</h3>
                <p>{form.message}</p>
            </div>
        {:else if form?.success}
            <div class="success">
                <h3>❕Success</h3>
                <p>{form.message}</p>
            </div>
        {/if}
    </form>
</main>

<Footer />
