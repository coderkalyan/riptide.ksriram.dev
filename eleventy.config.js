export default function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy("src/assets");
    // Browsers and crawlers probe /favicon.ico at the root regardless of markup.
    eleventyConfig.addPassthroughCopy({ "src/assets/favicon.ico": "favicon.ico" });

    return {
        dir: {
            input: "src",
            includes: "_includes",
            layouts: "_includes",
            output: "_site",
        },
        markdownTemplateEngine: "njk",
        htmlTemplateEngine: "njk",
    };
}
