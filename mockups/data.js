// Shared sample data for the two design mockups. Prices are your real saved ones,
// except the black pants' price drop and the Uniqlo "bought" state, which are made up to show those looks.
window.ITEMS = [
  { store: "H&M", title: "Regular Fit Rib-knit Zip-through Cardigan", price: 2999, colour: "#55595f", kind: "jacket", colourName: "Dark grey marl" },
  { store: "Bonkers Corner", title: "Olive Faded Loose Fit Pants", price: 1499, mrp: 1799, colour: "#6d7150", kind: "pants", colourName: "Olive" },
  { store: "Bonkers Corner", title: "Taupe Everyday Joggers", price: 1399, mrp: 1499, colour: "#8b7f70", kind: "pants", colourName: "Taupe" },
  { store: "Bonkers Corner", title: "Black Faded Loose Fit Pants", price: 1299, prev: 1499, mrp: 1799, colour: "#2b2b2e", kind: "pants", colourName: "Black" },
  { store: "H&M", title: "Felted Funnel-collar Jacket", price: 2799, colour: "#3c3d42", kind: "jacket", colourName: "Dark grey" },
  { store: "H&M", title: "Teddy Jacket", price: 1499, colour: "#e3d8c6", kind: "jacket", colourName: "Cream" },
  { store: "Uniqlo", title: "Fleece Full-Zip Jacket", price: 2490, colour: "#5c6068", kind: "jacket", colourName: "08 Dark Gray", bought: true },
];

window.money = (n) => "Rs. " + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A flat garment drawing standing in for a product photo.
window.garment = (kind, c) => {
  const shade = "rgba(0,0,0,.18)", light = "rgba(255,255,255,.22)";
  if (kind === "pants") {
    return `<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d="M96 46 H204 L222 352 H168 L150 132 L132 352 H78 Z" fill="${c}"/>
      <rect x="96" y="46" width="108" height="16" fill="${shade}"/>
      <path d="M150 62 V132" stroke="${shade}" stroke-width="2"/>
      <path d="M118 70 Q112 96 104 110" stroke="${light}" stroke-width="2" fill="none"/>
      <path d="M182 70 Q188 96 196 110" stroke="${light}" stroke-width="2" fill="none"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <path d="M100 66 L132 50 Q150 64 168 50 L200 66 L246 118 L262 296 L228 302 L212 168 L214 336 H86 L88 168 L72 302 L38 296 L54 118 Z" fill="${c}"/>
    <path d="M132 50 Q150 76 168 50 L172 58 Q150 92 128 58 Z" fill="${shade}"/>
    <path d="M150 70 V336" stroke="${light}" stroke-width="3"/>
    <path d="M88 320 H212" stroke="${shade}" stroke-width="10"/>
  </svg>`;
};
