load("config.js");

function execute(url, page) {
    if (!page) page = "1";
    url = hetuNormalizeUrl(url);

    var pageUrl = url;
    if (url.indexOf("{{page}}") > -1) {
        pageUrl = url.replace("{{page}}", page);
    } else if (parseInt(page) > 1 && url.indexOf("?") === -1) {
        pageUrl = url + "?page=" + page;
    }

    var doc = hetuGetDoc(pageUrl);
    if (!doc || hetuIsChallenge(doc)) {
        return Response.error("Cannot load list: " + hetuDebugDoc(doc));
    }

    var data = [];
    var seen = {};

    doc.select("a[href*='/book/']").forEach(function (el) {
        var link = (el.attr("href") || "") + "";
        if (!link || link.indexOf("/book/") === -1) return;
        if (link.match(/\/book\/\d+\/\d+\.html/)) return;
        link = hetuAbsUrl(link);
        if (!link.match(/\/book\/\d+(\/index\.html)?$/)) return;
        if (!link.endsWith("index.html")) link = link.replace(/\/?$/, "/index.html");
        if (seen[link]) return;
        seen[link] = true;

        var name = (el.text() || "").trim() + "";
        if (!name) {
            var parent = el.parent();
            if (parent) name = (parent.text() || "").trim() + "";
        }
        if (!name || name.length < 2) return;

        var cover = "";
        var imgEl = el.select("img").first();
        if (!imgEl && el.parent()) imgEl = el.parent().select("img").first();
        if (imgEl) {
            cover = (imgEl.attr("data-src") || imgEl.attr("src") || "") + "";
            cover = hetuAbsUrl(cover);
        }

        data.push({
            name: name,
            link: link,
            cover: cover,
            description: "",
            host: BASE_URL
        });
    });

    if (data.length === 0) return Response.error("No books found");

    var hasNext = doc.select(".next a, a.next, .pagination .next, a[rel='next']").size() > 0;
    var nextPage = hasNext ? String(parseInt(page) + 1) : null;
    return Response.success(data, nextPage);
}
