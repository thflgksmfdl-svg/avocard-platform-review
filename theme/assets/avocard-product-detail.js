(function () {
  'use strict';

  const root = document.querySelector('[data-av-product-detail]');
  if (!root) return;

  const ui = {
    status: root.querySelector('[data-product-status]'),
    content: root.querySelector('[data-product-content]'),
    title: root.querySelector('[data-product-title]'),
    secondaryTitle: root.querySelector('[data-secondary-title]'),
    offerId: root.querySelector('[data-offer-id]'),
    sourceLink: root.querySelector('[data-source-link]'),
    mainImage: root.querySelector('[data-main-image]'),
    noImage: root.querySelector('[data-no-image]'),
    thumbnails: root.querySelector('[data-thumbnails]'),
    priceRange: root.querySelector('[data-price-range]'),
    moq: root.querySelector('[data-moq]'),
    sellerName: root.querySelector('[data-seller-name]'),
    sellerLevel: root.querySelector('[data-seller-level]'),
    sellerScore: root.querySelector('[data-seller-score]'),
    repeatRate: root.querySelector('[data-repeat-rate]'),
    priceTiers: root.querySelector('[data-price-tiers]'),
    priceTierList: root.querySelector('[data-price-tier-list]'),
    skuList: root.querySelector('[data-sku-list]'),
    selectedQuantity: root.querySelector('[data-selected-quantity]'),
    selectedTotal: root.querySelector('[data-selected-total]'),
    cartButton: root.querySelector('[data-cart-button]'),
    cartMessage: root.querySelector('[data-cart-message]'),
    languageButtons: Array.from(root.querySelectorAll('[data-language]')),
  };

  const state = { product: null, language: 'ko', selectedSkuId: null, quantity: 0 };
  const offerId = new URLSearchParams(window.location.search).get('offerId')?.trim() || '';
  const isValidOfferId = /^\d{5,15}$/.test(offerId) && Number(offerId) <= Number.MAX_SAFE_INTEGER;
  const loginLink = root.querySelector('[data-login-link]');
  if (loginLink) {
    loginLink.href = `/account/login?return_url=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }

  function text(value, fallback) {
    return value === undefined || value === null || value === '' ? fallback : String(value);
  }

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `¥${number.toFixed(2)}` : '-';
  }

  function setStatus(title, message, action) {
    ui.content.hidden = true;
    ui.status.hidden = false;
    ui.status.replaceChildren();
    const heading = document.createElement('h1');
    heading.textContent = title;
    const body = document.createElement('p');
    body.textContent = message;
    ui.status.append(heading, body);
    if (action) ui.status.append(action);
  }

  function showError(error) {
    const status = error && error.status;
    if (status === 401 || status === 403) {
      const link = document.createElement('a');
      link.className = 'av-product-button';
      link.href = `/account/login?return_url=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      link.textContent = '로그인';
      setStatus('로그인을 확인해 주세요', '고객 인증을 확인할 수 없습니다. 로그인 후 다시 시도해 주세요.', link);
      return;
    }
    if (status === 404) {
      setStatus('상품을 찾을 수 없습니다', '삭제되었거나 판매가 종료된 1688 상품일 수 있습니다. offerId를 확인해 주세요.');
      return;
    }
    setStatus('상품 정보를 불러오지 못했습니다', '잠시 후 페이지를 새로고침하거나 고객센터에 문의해 주세요. 자동으로 재시도하지 않습니다.');
  }

  async function requestProduct(language) {
    const base = root.dataset.apiBaseUrl.replace(/\/$/, '');
    const url = `${base}/api/v1/catalog/products/${encodeURIComponent(offerId)}?country=${language}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const error = new Error(`Product API returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function translatedAttribute(attribute) {
    const name = state.language === 'ko' ? attribute.nameTrans || attribute.name : attribute.name;
    const value = state.language === 'ko' ? attribute.valueTrans || attribute.value : attribute.value;
    return `${text(name, '옵션')}: ${text(value, '-')}`;
  }

  function renderGallery(product) {
    ui.thumbnails.replaceChildren();
    const images = Array.isArray(product.imageUrls) ? product.imageUrls.filter(Boolean) : [];
    ui.noImage.hidden = images.length > 0;
    ui.mainImage.hidden = images.length === 0;
    if (!images.length) return;

    ui.mainImage.src = images[0];
    ui.mainImage.alt = text(product.titleTrans, product.titleZh);
    images.forEach((url, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'av-product-thumbnail';
      button.setAttribute('aria-label', `상품 이미지 ${index + 1}`);
      button.setAttribute('aria-current', index === 0 ? 'true' : 'false');
      const image = document.createElement('img');
      image.src = url;
      image.alt = '';
      image.loading = index === 0 ? 'eager' : 'lazy';
      button.append(image);
      button.addEventListener('click', () => {
        ui.mainImage.src = url;
        ui.thumbnails.querySelectorAll('button').forEach((item) => item.setAttribute('aria-current', 'false'));
        button.setAttribute('aria-current', 'true');
      });
      ui.thumbnails.append(button);
    });
  }

  function renderPrice(product) {
    const skuPrices = (product.skus || []).map((sku) => Number(sku.priceCny)).filter(Number.isFinite);
    const tierPrices = (product.priceTiers || []).map((tier) => Number(tier.priceCny)).filter(Number.isFinite);
    const prices = skuPrices.length ? skuPrices : tierPrices;
    if (!prices.length) {
      ui.priceRange.textContent = '가격 문의';
    } else {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      ui.priceRange.textContent = min === max ? money(min) : `${money(min)} ~ ${money(max)}`;
    }

    ui.priceTierList.replaceChildren();
    const tiers = product.priceTiers || [];
    ui.priceTiers.hidden = tiers.length === 0;
    tiers.forEach((tier) => {
      const row = document.createElement('div');
      const quantity = document.createElement('span');
      const price = document.createElement('strong');
      quantity.textContent = `${tier.startQuantity}개 이상`;
      price.textContent = money(tier.priceCny);
      row.append(quantity, price);
      ui.priceTierList.append(row);
    });
  }

  function updateSelection() {
    const sku = (state.product?.skus || []).find((item) => item.skuId === state.selectedSkuId);
    state.quantity = sku ? Math.max(0, Math.floor(state.quantity)) : 0;
    ui.selectedQuantity.textContent = String(state.quantity);
    ui.selectedTotal.textContent = sku ? money(Number(sku.priceCny) * state.quantity) : '¥0.00';
    ui.cartButton.disabled = true;

    window.dispatchEvent(new CustomEvent('avocard:product-selection-change', {
      detail: sku ? {
        offerId: state.product.offerId,
        skuId: sku.skuId,
        quantity: state.quantity,
        unitPriceCny: sku.priceCny,
        titleZh: state.product.titleZh,
        titleKo: state.product.titleTrans || null,
        imageUrl: sku.attributes.find((attribute) => attribute.imageUrl)?.imageUrl || state.product.imageUrls[0] || null,
        attributes: sku.attributes,
      } : null,
    }));
  }

  function renderSkus(product) {
    ui.skuList.replaceChildren();
    const skus = product.skus || [];
    if (!skus.length) {
      const empty = document.createElement('p');
      empty.className = 'av-sku-empty';
      empty.textContent = '선택 가능한 SKU가 없습니다.';
      ui.skuList.append(empty);
      updateSelection();
      return;
    }

    skus.forEach((sku, index) => {
      const card = document.createElement('label');
      card.className = 'av-sku-card';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'avocard-sku';
      radio.value = sku.skuId;
      radio.checked = state.selectedSkuId === sku.skuId;

      const imageUrl = (sku.attributes || []).find((attribute) => attribute.imageUrl)?.imageUrl;
      if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = '';
        image.loading = index < 4 ? 'eager' : 'lazy';
        card.append(image);
      }

      const details = document.createElement('span');
      details.className = 'av-sku-details';
      const name = document.createElement('strong');
      name.textContent = (sku.attributes || []).map(translatedAttribute).join(' / ') || `SKU ${sku.skuId}`;
      const meta = document.createElement('span');
      meta.textContent = `${money(sku.priceCny)} · 재고 ${text(sku.stock, '미확인')}`;
      details.append(name, meta);

      const quantity = document.createElement('input');
      quantity.type = 'number';
      quantity.className = 'av-sku-quantity';
      quantity.min = String(product.moq || 1);
      quantity.max = sku.stock === undefined ? '' : String(sku.stock);
      quantity.step = '1';
      quantity.value = radio.checked ? String(state.quantity || product.moq || 1) : String(product.moq || 1);
      quantity.disabled = !radio.checked;
      quantity.setAttribute('aria-label', `${name.textContent} 수량`);

      radio.addEventListener('change', () => {
        state.selectedSkuId = sku.skuId;
        state.quantity = Number(quantity.value);
        renderSkus(product);
      });
      quantity.addEventListener('input', () => {
        state.quantity = Number(quantity.value);
        updateSelection();
      });

      card.append(radio, details, quantity);
      ui.skuList.append(card);
    });
    updateSelection();
  }

  function render(product) {
    state.product = product;
    const primaryTitle = state.language === 'ko' ? product.titleTrans || product.titleZh : product.titleZh;
    const secondaryTitle = state.language === 'ko' ? product.titleZh : product.titleTrans;
    ui.title.textContent = text(primaryTitle, '상품명 없음');
    ui.secondaryTitle.textContent = text(secondaryTitle, '');
    ui.secondaryTitle.hidden = !secondaryTitle || secondaryTitle === primaryTitle;
    ui.offerId.textContent = `1688 offerId ${product.offerId}`;
    ui.moq.textContent = product.moq ? `${product.moq}개` : '미확인';
    ui.sellerName.textContent = text(product.seller?.companyName, '미확인');
    ui.sellerLevel.textContent = text(product.seller?.tradeMedalLevel, '미확인');
    ui.sellerScore.textContent = text(product.seller?.compositeServiceScore, '미확인');
    ui.repeatRate.textContent = text(product.seller?.repeatPurchasePercent, '미확인');
    ui.sourceLink.hidden = !product.sourceUrl;
    if (product.sourceUrl) ui.sourceLink.href = product.sourceUrl;
    ui.languageButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.language === state.language)));
    renderGallery(product);
    renderPrice(product);
    renderSkus(product);
    ui.status.hidden = true;
    ui.content.hidden = false;
  }

  async function load(language) {
    ui.content.setAttribute('aria-busy', 'true');
    try {
      const product = await requestProduct(language);
      state.language = language;
      render(product);
    } catch (error) {
      showError(error);
    } finally {
      ui.content.removeAttribute('aria-busy');
    }
  }

  ui.languageButtons.forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.language !== state.language) load(button.dataset.language);
  }));

  if (root.dataset.loggedIn !== 'true') return;
  if (!isValidOfferId) {
    setStatus('올바른 상품 주소가 아닙니다', '주소의 offerId는 숫자로 된 1688 상품 식별자여야 합니다.');
    return;
  }
  load('ko');
}());
