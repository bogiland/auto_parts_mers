const lexusPhoto = "2023_Lexus_RX_350_Premium_Plus_in_Matador_Red_Mica,_front_left.jpg";
const mercedesPhoto = "Mercedes-Benz_S_Class_W221_(6899311205).jpg";
const fordPhoto = "Ford_Escape_(fourth_generation)_1X7A6227.jpg";

const examples = [
  { name: "Lexus RX 350 · 2023", specs: "Бензин, 2,4 л турбо · 275 hp · 8-ступ. автомат", description: "Кроссовер. Для RX 350 предлагались передний и полный привод.", image: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${lexusPhoto}`, credit: "Mr.choppers · CC BY-SA 3.0", file: lexusPhoto, source: "https://pressroom.lexus.com/the-evolution-of-an-icon-the-all-new-2023-lexus-rx/" },
  { name: "Mercedes-Benz S 500 (W221) · 2012", specs: "Бензин, V8 4,7 л · 320 кВт (435 л. с.)", description: "Седан S-класса. Характеристики относятся к версии S 500 BlueEFFICIENCY.", image: `https://upload.wikimedia.org/wikipedia/commons/7/76/${mercedesPhoto}`, credit: "nakhon100 · CC BY 2.0", file: mercedesPhoto, source: "https://www.boe.es/boe/dias/2015/12/21/pdfs/BOE-A-2015-13918.pdf" },
  { name: "Ford Escape · 2022", specs: "Бензин, 1,5 л EcoBoost · автомат", description: "Кроссовер четвёртого поколения. Характеристики относятся к версии с 1,5 EcoBoost для рынка США.", image: `https://upload.wikimedia.org/wikipedia/commons/8/86/${fordPhoto}`, credit: "Alexander Migl · CC BY-SA 4.0", file: fordPhoto, source: "https://media.ford.com/content/dam/fordmedia/North%20America/US/product/2022/escape/22MY-Escape-Order-Guide.pdf" },
];

export function carListings(body: string) {
  const listings = body.split(/\r?\n/).flatMap(line => {
    if (!line.startsWith("Авто |")) return [];
    const [, name, specs, description, image] = line.split("|").map(value => value.trim());
    if (!name || !specs) return [];
    const safeImage = image?.startsWith("/") && !image.startsWith("//") ? image : "";
    return [{ name, specs, description, image: safeImage, credit: "", file: "", source: "" }];
  });
  return { listings: listings.length ? listings : examples, demo: listings.length === 0 };
}
