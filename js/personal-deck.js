(function () {
  var COOKIE_NAME = 'personal-deck';
  var COOKIE_DAYS = 365;

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/';
  }

  function getCookie(name) {
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
    }
    return null;
  }

  function getDeck() {
    var raw = getCookie(COOKIE_NAME);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
  }

  function saveDeck(deck) {
    setCookie(COOKIE_NAME, JSON.stringify(deck), COOKIE_DAYS);
  }

  function isInDeck(type, id) {
    return getDeck().some(function (item) { return item.type === type && item.id === id; });
  }

  function addToDeck(type, id) {
    var deck = getDeck();
    if (!deck.some(function (item) { return item.type === type && item.id === id; })) {
      deck.push({ type: type, id: id });
      saveDeck(deck);
    }
  }

  function removeFromDeck(type, id) {
    var deck = getDeck().filter(function (item) { return !(item.type === type && item.id === id); });
    saveDeck(deck);
  }

  function toggleDeck(type, id) {
    if (isInDeck(type, id)) {
      removeFromDeck(type, id);
      return false;
    } else {
      addToDeck(type, id);
      return true;
    }
  }

  window.PersonalDeck = {
    getDeck: getDeck,
    saveDeck: saveDeck,
    isInDeck: isInDeck,
    addToDeck: addToDeck,
    removeFromDeck: removeFromDeck,
    toggleDeck: toggleDeck
  };
})();
