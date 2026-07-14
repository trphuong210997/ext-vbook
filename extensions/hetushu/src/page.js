load("config.js");

function execute(url) {
    url = hetuNormalizeUrl(url);
    if (url.slice(-1) === "/") url = url.slice(0, -1);
    return Response.success([url]);
}
