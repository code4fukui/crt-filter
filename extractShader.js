import { HTMLParser } from "https://js.sabae.cc/HTMLParser.js";

const fn = Deno.args[0];
const html = await Deno.readTextFile(fn);
const dom = HTMLParser.parse(html);
const scs = dom.querySelectorAll("script");
const src = scs.map(sc => {
	const id = sc.getAttribute("id");
	return `"${id}": \`
${sc.text}
	\`,\n`;
});
console.log("export const shaders = {\n" + src.join("") + "\n};\n");

