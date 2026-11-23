/* ============================================================
   motor-calculo.js — Motor unico de despiece y costos
   Fuente de verdad compartida por calculadora.html y presupuesto.html
   Expuesto como window.MotorCalculo (sin modulos ES, funciona en file://)
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- constantes de despiece ---------- */
  const DESC = {
    TECHO_PISO: 36, FONDO_MUEBLE: 36, PUERTA: 3, REPISA_ANCHO: 36, REPISA_PROF: 18,
    REPISA_ESPESOR: 18, EXTRA_GAVETA_ANCHO: 36, GAVETA_PROF_REDUCCION: 116,
    RODAPIE_ALTO: 150, RODAPIE_ANCHO_DESC: 36, BLUM_FONDO_DESC: 98,
    BLUM_LATERAL_ALTO: 16, BLUM_LATERAL_LARGO: 500, BLUM_FRENTE_ANCHO_DESC: 74.2,
    BLUM_FRENTE_ALTO: 150, GAVETA_ALTO_EXTRA: 11
  };
  const CORREDERAS = {
    telescopica: { holgura: 25 },
    oculta: { holgura: 10 },
    ocultaBlum: { holgura: 74.2 }
  };
  const COMPONENTES_REVESTIMIENTO = ['Puerta', 'Frente de gaveta', 'Frente interno gaveta',
    'Frente interno gaveta (Blum)', 'Panel', 'Finta', 'Rodapié'];

  /* ---------- parametros por defecto (los de calculadora.html) ---------- */
  const DEFAULTS = {
    largo: 2440,
    ancho: 1830,
    desperdicio: 15,
    precioEstructura: 100,
    precioRevestimiento: 150,
    precioCantoEstructura: 0.50,
    precioCantoRevestimiento: 1.00,
    precioEnchapado: 2.36,
    precioCorte: 0.91,
    cantidadCortesPorLamina: 5,
    precioParBisagra: 2.50,
    precioSetPatasGlobal: 3.00,
    porcentajeManoObra: 20,
    porcentajeGastosAdmin: 15
  };

  const CATALOGOS_VACIOS = {
    tornillos: [], bisagraRecta: null, elevacion: [], platera: [], condimentero: []
  };

  /* ---------- utilidades ---------- */
  const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const r2 = (n) => Math.round(num(n) * 100) / 100;
  const r3 = (n) => Math.round(num(n) * 1000) / 1000;
  let seq = 0;
  const nuevoId = () => Date.now() + (seq++ % 1000) + Math.floor(Math.random() * 1000);

  function esRevestimiento(nombre) {
    const n = String(nombre || '');
    return COMPONENTES_REVESTIMIENTO.some((rev) => n.startsWith(rev));
  }
  function tipoLamina(nombre) { return esRevestimiento(nombre) ? 'revestimiento' : 'estructura'; }

  function normalizarConfig(cfg) {
    const c = Object.assign({}, DEFAULTS, cfg || {});
    c.largo = num(c.largo) || DEFAULTS.largo;
    c.ancho = num(c.ancho) || DEFAULTS.ancho;
    c.areaTableroM2 = (c.largo * c.ancho) / 1000000;
    return c;
  }

  function calcularParesBisagras(altoPuerta) {
    if (altoPuerta <= 800) return 1;
    if (altoPuerta <= 1400) return 2;
    return 3;
  }
  function getNombreCorredera(t) {
    if (t === 'telescopica') return 'Telescópica estándar';
    if (t === 'oculta') return 'Oculta genérica';
    if (t === 'ocultaBlum') return 'Oculta Blum / Push';
    return t;
  }
  function getPrecioCorredera(t, p) {
    if (!p) return 0;
    if (t === 'telescopica') return num(p.telescopica);
    if (t === 'oculta') return num(p.oculta);
    if (t === 'ocultaBlum') return num(p.blum);
    return 0;
  }

  /* ---------- despiece ---------- */
  function despieceDesdeMedidas(medidas, opts, colores, cat) {
    const alto = num(medidas.alto), ancho = num(medidas.ancho), prof = num(medidas.prof);
    const espesor = num(medidas.espesor) || 18;
    const veta = medidas.veta || 'Vertical';
    const o = opts || {};
    const col = colores || { lateral: 'Blanco', pisoTecho: 'Blanco', fondo: 'Blanco', puerta: 'Roble' };
    const catal = Object.assign({}, CATALOGOS_VACIOS, cat || {});
    const baseMat = `Tablero ${espesor} mm`;

    const P = (componente, cantidad, material, w, h, observaciones, cantos, esHerraje) => ({
      id: nuevoId(),
      componente, cantidad, material, ancho: w, alto: h, observaciones,
      veta, esHerraje: !!esHerraje,
      cantos: cantos || { sup: false, inf: false, izq: false, der: false }
    });

    let reduccionAltura = 0;
    if (o.tiradores && o.tiradores.incluir && o.tiradores.tipoPrincipal === 'perfil' &&
        o.tiradores.variedad === 'gola' && o.tiradores.categoriaGola === 'L') {
      reduccionAltura = o.tiradores.reduccionAltura || 30;
    }

    const piezas = [
      P('Lateral', 2, `${baseMat} (${col.lateral})`, prof, alto, 'Lateral', { sup: true, inf: true, izq: false, der: true }),
      P('Techo / Piso', 2, `${baseMat} (${col.pisoTecho})`, ancho - DESC.TECHO_PISO, prof, 'Techo/Piso', { sup: true, inf: true, izq: false, der: false }),
      P('Fondo', 1, `${baseMat} (${col.fondo})`, ancho - DESC.FONDO_MUEBLE, alto - DESC.FONDO_MUEBLE, 'Fondo', { sup: false, inf: false, izq: false, der: false })
    ];

    if (o.incluirRepisas && o.cantRepisas > 0) {
      piezas.push(P('Repisa', o.cantRepisas, `Tablero ${DESC.REPISA_ESPESOR} mm (${col.pisoTecho})`,
        ancho - DESC.REPISA_ANCHO, prof - DESC.REPISA_PROF, 'Repisa', { sup: true, inf: false, izq: false, der: false }));
    }

    let numPuertas = 0, altoPuertaCalc = 0;
    if (o.incluirPuertas && o.cantPuertas > 0) {
      numPuertas = o.cantPuertas;
      // Medidas exactas de puertas: alto = altoLateral - 3 ; ancho = (ancho - 3*N)/N
      const altoPuerta = alto - DESC.PUERTA;
      const anchoPuerta = (ancho - (DESC.PUERTA * numPuertas)) / numPuertas;
      altoPuertaCalc = altoPuerta - reduccionAltura;
      piezas.push(P(numPuertas === 1 ? 'Puerta' : `Puerta (${numPuertas} uds.)`, numPuertas,
        `${baseMat} (${col.puerta})`, anchoPuerta, altoPuertaCalc,
        `Puerta${reduccionAltura ? ' (Perfil L)' : ''}`,
        { sup: true, inf: true, izq: true, der: true }));
    }
    // Sin puertas y sin gavetas no se agrega ninguna puerta implicita (mueble abierto).
    if (numPuertas > 0) {
      const ppp = calcularParesBisagras(altoPuertaCalc);
      piezas.push(P(`Bisagras de cazoleta (${ppp} par${ppp > 1 ? 'es' : ''} por puerta)`, ppp * numPuertas,
        'Herraje metálico (Pares)', 0, 0, '', { sup: false, inf: false, izq: false, der: false }, true));
    }

    if (o.incluirGavetas && o.cantGavetas > 0) {
      const n = o.cantGavetas;
      const holguraFrente = 3;
      let altoFrente = (alto - (holguraFrente * (n + 1))) / n;
      if (reduccionAltura > 0) altoFrente -= reduccionAltura;
      const anchoFrente = ancho - (holguraFrente * 2);
      piezas.push(P('Frente de gaveta', n, `${baseMat} (${col.puerta})`, anchoFrente, altoFrente,
        `Frente visible${reduccionAltura ? ' (Perfil L)' : ''}`,
        { sup: true, inf: true, izq: true, der: true }));

      let anchoCajon = 0;
      if (o.tipoCorredera === 'ocultaBlum') {
        const afi = ancho - DESC.BLUM_FRENTE_ANCHO_DESC;
        const fg = prof - DESC.BLUM_FONDO_DESC;
        const alb = DESC.BLUM_LATERAL_ALTO + DESC.GAVETA_ALTO_EXTRA;
        const afib = DESC.BLUM_FRENTE_ALTO + DESC.GAVETA_ALTO_EXTRA;
        piezas.push(P('Lateral de gaveta (Blum)', n * 2, `${baseMat} (${col.lateral})`, DESC.BLUM_LATERAL_LARGO, alb, 'Blum', { sup: true, inf: false, izq: false, der: true }));
        piezas.push(P('Frente interno gaveta (Blum)', n * 2, `${baseMat} (${col.lateral})`, afi, afib, 'Blum', { sup: true, inf: true, izq: false, der: false }));
        piezas.push(P('Fondo de gaveta (Blum)', n, `Tablero 15 mm (${col.fondo})`, afi, fg, 'Blum', { sup: false, inf: false, izq: false, der: false }));
      } else {
        const conf = CORREDERAS[o.tipoCorredera] || CORREDERAS.telescopica;
        if (o.tipoCorredera === 'oculta') anchoCajon = ancho - 84;
        else anchoCajon = ancho - (espesor * 2) - conf.holgura - DESC.EXTRA_GAVETA_ANCHO;

        const profCajon = num(o.profGaveta) || 500;
        const altoLateral = (num(o.altoGaveta) || 150) + DESC.GAVETA_ALTO_EXTRA;
        piezas.push(P('Lateral de gaveta', n * 2, `${baseMat} (${col.lateral})`, profCajon, altoLateral, 'Lateral', { sup: true, inf: false, izq: false, der: true }));
        piezas.push(P('Frente interno gaveta', n * 2, `${baseMat} (${col.lateral})`, anchoCajon, altoLateral, 'Frente', { sup: true, inf: true, izq: false, der: false }));
        piezas.push(P('Fondo de gaveta', n, `Tablero 15 mm (${col.fondo})`, anchoCajon, prof - DESC.GAVETA_PROF_REDUCCION, 'Fondo', { sup: false, inf: false, izq: false, der: false }));
      }
      const nombreCorredera = getNombreCorredera(o.tipoCorredera);
      piezas.push(P(`Par de correderas (${nombreCorredera})`, n, 'Herraje metálico (Pares)', 0, 0, nombreCorredera, { sup: false, inf: false, izq: false, der: false }, true));
    }

    if (o.incluirPanel && o.cantPanel > 0) {
      const desc = o.descripcionPanel && o.descripcionPanel.trim();
      let altoPanelFinal = num(o.altoPanel);
      if (reduccionAltura > 0) altoPanelFinal -= reduccionAltura;
      piezas.push(P(desc ? `Panel (${desc})` : 'Panel', o.cantPanel, `Tablero ${num(o.espesorPanel) || 18} mm (${col.pisoTecho})`,
        num(o.anchoPanel), altoPanelFinal, `Panel${reduccionAltura ? ' (Perfil L)' : ''}`,
        { sup: true, inf: true, izq: true, der: true }));
    }
    if (o.incluirFinta && o.cantFinta > 0) {
      const desc = o.descripcionFinta && o.descripcionFinta.trim();
      piezas.push(P(desc ? `Finta (${desc})` : 'Finta', o.cantFinta, `Tablero ${num(o.espesorFinta) || 18} mm (${col.pisoTecho})`,
        num(o.anchoFinta), num(o.altoFinta), 'Finta', { sup: true, inf: true, izq: true, der: true }));
    }
    if (o.incluirRodapie && o.cantRodapie > 0) {
      const desc = o.descripcionRodapie && o.descripcionRodapie.trim();
      piezas.push(P(desc ? `Rodapié (${desc})` : 'Rodapié', o.cantRodapie, `Tablero ${num(o.espesorRodapie) || 18} mm (${col.pisoTecho})`,
        ancho - DESC.RODAPIE_ANCHO_DESC, DESC.RODAPIE_ALTO, 'Rodapié', { sup: true, inf: false, izq: false, der: false }));
    }
    if (o.incluirPatas) {
      piezas.push(P('Patas plásticas regulables (set 4 uds.)', 1, 'Herraje plástico', 0, 0, 'Set 4 patas', { sup: false, inf: false, izq: false, der: false }, true));
    }
    if (o.tiradores && o.tiradores.incluir) {
      const tipoTxt = o.tiradores.tipoPrincipal === 'sobreponer' ? 'Sobreponer' : `Perfil ${o.tiradores.categoriaGola}`;
      piezas.push(P(`Tirador ${tipoTxt} (${o.tiradores.color || 'Aluminio'})`, o.tiradores.cantidad || 1,
        'Herraje metálico (Tirador)', 0, 0, 'Tirador', { sup: false, inf: false, izq: false, der: false }, true));
    }

    (catal.tornillos || []).forEach((t) => {
      if (o.tornillos && o.tornillos[t.key] && o.tornillos[t.key].incluir) {
        piezas.push(P(`${t.etiqueta} (bolsa)`, 1, 'Herraje metálico (Tornillos)', 0, 0, 'Bolsa de 100 unidades', { sup: false, inf: false, izq: false, der: false }, true));
      }
    });
    if (catal.bisagraRecta && o.bisagraRecta && o.bisagraRecta.incluir && o.bisagraRecta.cantidad > 0) {
      piezas.push(P(`${catal.bisagraRecta.etiqueta} (unidad)`, o.bisagraRecta.cantidad, 'Herraje metálico (Unidades)', 0, 0, 'Bisagra recta adicional', { sup: false, inf: false, izq: false, der: false }, true));
    }
    (catal.elevacion || []).forEach((e) => {
      if (o.elevacion && o.elevacion[e.key] && o.elevacion[e.key].incluir) {
        piezas.push(P(`${e.etiqueta} (unidad)`, 1, 'Herraje metálico (Sistema elevación)', 0, 0, e.etiqueta, { sup: false, inf: false, izq: false, der: false }, true));
      }
    });
    (catal.platera || []).forEach((p) => {
      if (o.platera && o.platera[p.key] && o.platera[p.key].incluir) {
        piezas.push(P(`${p.etiqueta} (kit escurridor)`, 1, 'Herraje metálico (Platera)', 0, 0, p.etiqueta, { sup: false, inf: false, izq: false, der: false }, true));
      }
    });
    (catal.condimentero || []).forEach((cd) => {
      if (o.condimentero && o.condimentero[cd.key] && o.condimentero[cd.key].incluir) {
        piezas.push(P(`${cd.etiqueta} (kit condimentero)`, 1, 'Herraje metálico (Condimentero)', 0, 0, cd.etiqueta, { sup: false, inf: false, izq: false, der: false }, true));
      }
    });

    return piezas;
  }

  /* ---------- cantos ---------- */
  function mlCantosPieza(p) {
    if (!p || p.esHerraje) return 0;
    const c = p.cantos || {};
    let ml = 0;
    if (c.sup) ml += num(p.ancho) / 1000;
    if (c.inf) ml += num(p.ancho) / 1000;
    if (c.izq) ml += num(p.alto) / 1000;
    if (c.der) ml += num(p.alto) / 1000;
    return ml;
  }

  /* ---------- costos de herrajes por pieza ---------- */
  function acumularHerrajes(c, cantTotal, m, k, cat, acc) {
    const n = String(c.componente || '').toLowerCase();
    const precioCorredera = num(m.precioCorredera);
    const precioPatas = num(m.precioSetPatas);
    if (n.indexOf('bisagras de cazoleta') >= 0) acc.bisagras += cantTotal * k.precioParBisagra;
    if (n.indexOf('correderas') >= 0) acc.correderas += cantTotal * precioCorredera;
    if (n.indexOf('patas') >= 0) acc.patas += cantTotal * (precioPatas || k.precioSetPatasGlobal);
    if (n.indexOf('tornillos') >= 0 && m.tornillos) {
      (cat.tornillos || []).forEach((t) => {
        const clave = t.etiqueta.toLowerCase().split(' x100')[0];
        if (n.indexOf(clave) >= 0 && m.tornillos[t.key] && m.tornillos[t.key].incluir) {
          acc.tornillos += cantTotal * num(m.tornillos[t.key].precio);
        }
      });
    }
    if (n.indexOf('bisagra recta') >= 0 && m.bisagraRecta && m.bisagraRecta.incluir) {
      acc.bisagraRecta += cantTotal * num(m.bisagraRecta.precio);
    }
    (cat.elevacion || []).forEach((e) => {
      if (n.indexOf(e.etiqueta.toLowerCase()) >= 0 && m.elevacion && m.elevacion[e.key] && m.elevacion[e.key].incluir) {
        acc.elevacion += cantTotal * num(m.elevacion[e.key].precio);
      }
    });
    (cat.platera || []).forEach((p) => {
      if (n.indexOf(p.etiqueta.toLowerCase()) >= 0 && m.platera && m.platera[p.key] && m.platera[p.key].incluir) {
        acc.platera += cantTotal * num(m.platera[p.key].precio);
      }
    });
    (cat.condimentero || []).forEach((cd) => {
      if (n.indexOf(cd.etiqueta.toLowerCase()) >= 0 && m.condimentero && m.condimentero[cd.key] && m.condimentero[cd.key].incluir) {
        acc.condimentero += cantTotal * num(m.condimentero[cd.key].precio);
      }
    });
    if (n.indexOf('tirador') >= 0 && m.tiradores && m.tiradores.incluir) {
      acc.tiradores += cantTotal * num(m.tiradores.precio);
    }
  }

  /* ---------- desglose por mueble (sin reparto de material) ---------- */
  function desgloseMueble(m, k, cat) {
    const cantMueble = num(m.cantidad) || 1;
    const f = {
      id: m.id, nombre: m.nombre || '', cantMueble,
      piezas: 0, areaNeta: 0, areaEst: 0, areaRev: 0, mlEst: 0, mlRev: 0,
      bisagras: 0, correderas: 0, tiradores: 0, patas: 0, tornillos: 0,
      bisagraRecta: 0, elevacion: 0, platera: 0, condimentero: 0
    };
    (m.componentes || []).forEach((c) => {
      const cantTotal = num(c.cantidad) * cantMueble;
      if (c.esHerraje) { acumularHerrajes(c, cantTotal, m, k, cat, f); return; }
      const area = (num(c.ancho) * num(c.alto) * cantTotal) / 1000000;
      f.areaNeta += area;
      if (tipoLamina(c.componente) === 'revestimiento') f.areaRev += area; else f.areaEst += area;
      f.piezas += cantTotal;
      const ml = mlCantosPieza(c) * cantTotal;
      if (tipoLamina(c.componente) === 'revestimiento') f.mlRev += ml; else f.mlEst += ml;
    });
    f.mlEst = r3(f.mlEst);
    f.mlRev = r3(f.mlRev);
    f.mlTotal = r3(f.mlEst + f.mlRev);
    f.areaDescEst = f.areaEst * (1 + num(k.desperdicio) / 100);
    f.areaDescRev = f.areaRev * (1 + num(k.desperdicio) / 100);
    f.areaDesc = f.areaDescEst + f.areaDescRev;
    f.costoCantoEst = r2(f.mlEst * num(k.precioCantoEstructura));
    f.costoCantoRev = r2(f.mlRev * num(k.precioCantoRevestimiento));
    f.costoEnchapado = r2(f.mlTotal * num(k.precioEnchapado));
    f.herrajes = r2(f.bisagras + f.correderas + f.tiradores + f.patas + f.tornillos +
      f.bisagraRecta + f.elevacion + f.platera + f.condimentero);
    return f;
  }

  /* ---------- proyecto completo ---------- */
  function calcularProyecto(muebles, cfg, cat) {
    const k = normalizarConfig(cfg);
    const catal = Object.assign({}, CATALOGOS_VACIOS, cat || {});
    const filas = (muebles || []).map((m) => desgloseMueble(m, k, catal));

    const areaDescEst = filas.reduce((a, f) => a + f.areaDescEst, 0);
    const areaDescRev = filas.reduce((a, f) => a + f.areaDescRev, 0);
    const tablerosEst = areaDescEst > 0 ? Math.ceil(areaDescEst / k.areaTableroM2) : 0;
    const tablerosRev = areaDescRev > 0 ? Math.ceil(areaDescRev / k.areaTableroM2) : 0;
    const costoMatEst = tablerosEst * num(k.precioEstructura);
    const costoMatRev = tablerosRev * num(k.precioRevestimiento);

    filas.forEach((f, i) => {
      // reparto del costo de laminas por superficie (ultima fila absorbe el redondeo)
      f.tablerosEst = areaDescEst > 0 ? Math.ceil(f.areaDescEst / k.areaTableroM2) : 0;
      f.tablerosRev = areaDescRev > 0 ? Math.ceil(f.areaDescRev / k.areaTableroM2) : 0;
      f.costoMatEst = areaDescEst > 0 ? r2(costoMatEst * f.areaDescEst / areaDescEst) : 0;
      f.costoMatRev = areaDescRev > 0 ? r2(costoMatRev * f.areaDescRev / areaDescRev) : 0;
      f.costoMateriales = r2(f.costoMatEst + f.costoMatRev);
      f.costoCortes = r2((f.tablerosEst + f.tablerosRev) * num(k.cantidadCortesPorLamina) * num(k.precioCorte));
      f.subtotal = r2(f.costoMateriales + f.costoCantoEst + f.costoCantoRev + f.costoEnchapado + f.costoCortes + f.herrajes);
      f.manoObra = r2(f.subtotal * num(k.porcentajeManoObra) / 100);
      f.gastosAdmin = r2((f.subtotal + f.manoObra) * num(k.porcentajeGastosAdmin) / 100);
      f.total = r2(f.subtotal + f.manoObra + f.gastosAdmin);
    });

    const suma = (campo) => filas.reduce((a, f) => a + num(f[campo]), 0);
    const totales = {
      muebles: filas.length,
      piezas: suma('piezas'),
      areaNeta: suma('areaNeta'), areaEst: suma('areaEst'), areaRev: suma('areaRev'),
      areaDesc: areaDescEst + areaDescRev,
      areaDescEst, areaDescRev,
      mlEst: suma('mlEst'), mlRev: suma('mlRev'),
      tablerosEst, tablerosRev, tablerosTotal: tablerosEst + tablerosRev,
      costoMatEst: r2(costoMatEst), costoMatRev: r2(costoMatRev),
      costoMateriales: r2(costoMatEst + costoMatRev),
      costoCantoEst: suma('costoCantoEst'), costoCantoRev: suma('costoCantoRev'),
      costoEnchapado: suma('costoEnchapado'), costoCortes: suma('costoCortes'),
      bisagras: r2(suma('bisagras')), correderas: r2(suma('correderas')),
      tiradores: r2(suma('tiradores')), patas: r2(suma('patas')),
      tornillos: r2(suma('tornillos')), bisagraRecta: r2(suma('bisagraRecta')),
      elevacion: r2(suma('elevacion')), platera: r2(suma('platera')),
      condimentero: r2(suma('condimentero')),
      subtotal: r2(suma('subtotal')),
      manoObra: r2(suma('manoObra')),
      gastosAdmin: r2(suma('gastosAdmin')),
      total: r2(suma('total'))
    };
    totales.herrajes = r2(totales.subtotal - totales.costoMateriales - totales.costoCantoEst -
      totales.costoCantoRev - totales.costoEnchapado - totales.costoCortes);
    return { filas, totales, config: k };
  }

  /* ---------- lineas de presupuesto para un mueble ---------- */
  function lineasDesdeMueble(m, cfg, cat) {
    const r = calcularProyecto([m], cfg, cat);
    const f = r.filas[0];
    if (!f) return [];
    const k = r.config;
    const L = [];
    const add = (desc, unidad, cant, precio) => {
      const c = r3(cant);
      if (c > 0) L.push({ desc, unidad, cant: c, precio: num(precio), total: r2(c * num(precio)) });
    };
    add(`TABLERO ESTRUCTURA ${m.espesor || 18} MM`, 'TABLERO', f.tablerosEst, k.precioEstructura);
    add(`TABLERO REVESTIMIENTO ${m.espesor || 18} MM`, 'TABLERO', f.tablerosRev, k.precioRevestimiento);
    add('TAPA CANTO ESTRUCTURA 0,45 MM', 'ML', f.mlEst, k.precioCantoEstructura);
    add('TAPA CANTO REVESTIMIENTO 1 MM', 'ML', f.mlRev, k.precioCantoRevestimiento);
    add('SERVICIO DE CORTE', 'UNIDAD', (f.tablerosEst + f.tablerosRev) * k.cantidadCortesPorLamina, k.precioCorte);
    add('SERVICIO DE ENCHAPADO', 'UNIDAD', f.mlTotal, k.precioEnchapado);
    if (f.bisagras > 0) add('BISAGRAS DE CAZOLETA', 'PAR', f.bisagras / (k.precioParBisagra || 1), k.precioParBisagra);
    if (f.correderas > 0) add('CORREDERAS', 'PAR', f.correderas / ((m.precioCorredera || 0) || 1), m.precioCorredera);
    if (f.tiradores > 0) add('TIRADORES', 'UNIDAD', f.tiradores / ((m.tiradores && m.tiradores.precio) || 1), m.tiradores && m.tiradores.precio);
    if (f.patas > 0) add('SET DE PATAS', 'SET', f.patas / ((m.precioSetPatas || 0) || 1), m.precioSetPatas);
    return { lineas: L, resumen: f, totales: r.totales };
  }

  /* ---------- totales a partir de lineas (presupuesto) ---------- */
  function totalesDesdeLineas(lineas, pctManoObra, pctGastosAdmin) {
    const base = (lineas || []).reduce((a, l) =>
      a + (l.total != null ? num(l.total) : num(l.cant) * num(l.precio)), 0);
    const manoObra = base * num(pctManoObra) / 100;
    const gastosAdmin = (base + manoObra) * num(pctGastosAdmin) / 100;
    return {
      base: r2(base),
      manoObra: r2(manoObra),
      gastosAdmin: r2(gastosAdmin),
      total: r2(base + manoObra + gastosAdmin)
    };
  }

  global.MotorCalculo = {
    version: '1.0.0',
    DESC, CORREDERAS, DEFAULTS, CATALOGOS_VACIOS,
    normalizarConfig, esRevestimiento, tipoLamina,
    calcularParesBisagras, getNombreCorredera, getPrecioCorredera,
    mlCantosPieza, despieceDesdeMedidas,
    calcularProyecto, lineasDesdeMueble, totalesDesdeLineas
  };
})(typeof window !== 'undefined' ? window : this);
