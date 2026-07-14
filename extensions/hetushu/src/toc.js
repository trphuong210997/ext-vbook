load("config.js");

function execute(url) {
    url = hetuNormalizeUrl(url);
    if (url.slice(-1) === "/") url = url.slice(0, -1);

    var bookId = hetuBookId(url);
    var chapters = [];
    var seen = {};

    if (bookId) {
        var jsonUrl = BASE_URL + "/book/" + bookId + "/dir.json";
        var jsonRes = fetch(jsonUrl, {
            headers: hetuFetchHeaders(url),
            timeout: 10000
        });
        if (jsonRes.ok) {
            var raw = jsonRes.text() + "";
            if (raw.indexOf("Just a moment") === -1 && raw.indexOf("Chờ một chút") === -1) {
                var re = /\["dd","([^"]*)","(\d+)"\]/g;
                var match;
                while ((match = re.exec(raw)) !== null) {
                    var chapName = match[1];
                    var chapId = match[2];
                    var chapUrl = BASE_URL + "/book/" + bookId + "/" + chapId + ".html";
                    if (!seen[chapUrl]) {
                        seen[chapUrl] = true;
                        chapters.push({ name: chapName, url: chapUrl, host: BASE_URL });
                    }
                }
            }
        }
    }

    if (chapters.length === 0) {
        var doc = hetuGetDoc(url);
        if (!doc || hetuIsChallenge(doc)) return Response.error("Cannot load TOC");

        doc.select("#dir dd a, #dir a, .chapter-list a, a[href*='/book/']").forEach(function (el) {
            var chapName = (el.text() || "").trim() + "";
            var chapUrl = (el.attr("href") || "") + "";
            if (!chapName || !chapUrl) return;
            if (chapUrl.indexOf("/book/") === -1) return;
            if (chapUrl.indexOf("index.html") > -1) return;
            if (!chapUrl.match(/\/book\/\d+\/\d+\.html/)) return;
            chapUrl = hetuAbsUrl(chapUrl);
            if (seen[chapUrl]) return;
            seen[chapUrl] = true;
            chapters.push({ name: chapName, url: chapUrl, host: BASE_URL });
        });
    }

    if (chapters.length === 0) return Response.error("No chapters found");
    return Response.success(chapters);
}
