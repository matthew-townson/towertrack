<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    export let data;
</script>

<svelte:head>
    <title>Privacy Policy | towertracker</title>
    <meta name="description" content="How towertracker collects, uses, and protects personal information." />
</svelte:head>

<Header user={data.user} />

<main class="section">
    <div class="container">
        <article class="content box">
            <h1 class="title">Privacy Policy</h1>
            <p class="is-size-7 has-text-grey">Last updated: 19<sup>th</sup> of November 2026</p>

            <h2>0. Preamble</h2>
            <p>We take privacy seriously and are committed to protecting your personal data. We will never sell, or share your personal data to third parties without your explicit consent.</p>

            <h2>1. About this policy</h2>
            <p>This policy explains how towertracker collects and uses data when you use the website. It covers account data, ringing data, maps, calendars, notifications, and cookies.</p>

            <h2>2. Data we collect</h2>
            <h3>Account <datalist></datalist></h3>
            <p>
                When you register or update your account, we store your username, email address, password hash, profile image, aliases, permission level, privacy settings, and profile preferences.
                Passwords are stored as hashes and are not stored in a readable format.
            </p>

            <h3>Ringing and calendar activity</h3>
            <p>Depending on how you use towertracker, we store your tower grabs, performance data imported from BellBoard, calendar events and invitations, user lists, notifications, and settings.</p>

            <h3>Location data</h3>
            <p>
                Map and tower location features may request your browser's location permission. Your location is used to display nearby towers and position data on the map.
                You can disable location access in your browser at any time.
                <br>
                <strong>We never store your location data or location history.</strong>
            </p>

            <h2>3. How we use data</h2>
            <p>We use data to provide accounts session persistence, display and maintain your ringing records, calculate statistics, operate maps and calendars, deliver notifications, improve the service, prevent misuse, and administer the website.</p>

            <h2>4. Cookies and browser storage</h2>
            <p>towertracker uses essential cookies to keep you signed in and prevent from cross-site request forgery. The session cookie lasts up to seven days unless you log out or if you clear it manually. The CSRF cookie lasts up to 24 hours.</p>
            <p>We use local browser storage for interface preferences, including calendar view mode and whether the domain-migration notice has been dismissed. These preferences are not used for advertising, and are used for purely functional purposes.</p>

            <h2>5. Visibility and sharing</h2>
            <p>
                Your profile visibility and data visibility settings control whether other users can view parts of your account and ringing data. Calendar sharing and invitation features make the information you choose to share available to selected users or through a sharing link.
                Public profile, map, or calendar features may display information if you have chosen to make data public. You can change your visibility settings at any time in your account settings.
            </p>

            <h2>6. Data sources and third parties</h2>
            <p>
                Tower and bell data is sourced from <a href="https://dove.cccbr.org.uk/" target="_blank" rel="noopener noreferrer">Dove's Guide for Church Bell Ringers</a> and <a href="https://www.bellboard.co.uk/" target="_blank" rel="noopener noreferrer">BellBoard</a>.
                External links and map resources are governed by the privacy policies of those services. We do not sell personal information or use advertising trackers.
            </p>

            <h2>7. Security and retention</h2>
            <p>
                We take reasonable technical measures to protect stored information, including hashed passwords, protected session cookies, and access controls. Information is retained while your account remains active or for as long as needed to provide the service and maintain its records.
                We may retain limited logs for security and administration purposes.
            </p>

            <h2>8. Your choices and rights</h2>
            <p>
                You can update account, email, privacy, and ringing preferences in your account settings. You can remove profile information or request deletion of your account and associated data where applicable.
                You can also block cookies or browser location access through your browser settings.
            </p>

            <h2>9. Children</h2>
            <p>towertracker is intended for users who can lawfully create an account and provide consent in their jurisdiction. Where relevant law requires consent from a parent or guardian, that consent must be obtained.</p>

            <h2>10. Changes to this policy</h2>
            <p>We may update this policy when the service or legal requirements change. The date above shows when it was last revised. Material changes may also be announced on the website.</p>

            <h2>11. Contact</h2>
            <p>For privacy questions or account deletion requests, contact <a href="https://mtownson.com" target="_blank" rel="noopener noreferrer">Matthew Townson</a> or use the contact details available on that website.</p>
        </article>
    </div>
</main>

<Footer />
