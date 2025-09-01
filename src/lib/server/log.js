function log(type, message) {
    const timestamp = new Date().toISOString();
    console.log(`[ ${type} ] ${message}`);
}

function info(message) {
    log('INFO', message);
}

function error(message) {
    log('ERROR', message);
}

function success(message) {
    log('SUCCESS', message);
}

export default {
    log,
    info,
    error,
    success
};