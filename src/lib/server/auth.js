import { redirect } from '@sveltejs/kit';

export function redirectToLogin(url, loginPath = '/account/login', status = 303) {
    const destination = `${url.pathname}${url.search}`;
    throw redirect(status, `${loginPath}?redirect=${encodeURIComponent(destination)}`);
}

export function getPostLoginRedirect(url) {
    const destination = url.searchParams.get('redirect');
    return destination?.startsWith('/') && !destination.startsWith('//')
        ? destination
        : '/home';
}
