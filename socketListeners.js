// Wait for the socket to be initialized
document.addEventListener('DOMContentLoaded', () => {
  if (!window.socket) {
    console.error('Socket not initialized');
    return;
  }

  // On connection get all available offers and call createOfferEls
  window.socket.on("availableOffers", (offers) => {
    console.log(offers);
    createOfferEls(offers);
  });

  // Someone just made a new offer and we're already here - call createOfferEls
  window.socket.on("newOfferAwaiting", (offers) => {
    createOfferEls(offers);
  });

  window.socket.on("answerResponse", (offerObj) => {
    console.log(offerObj);
    addAnswer(offerObj);
  });

  window.socket.on("receivedIceCandidateFromServer", (iceCandidate) => {
    addNewIceCandidate(iceCandidate);
    console.log(iceCandidate);
  });

  // Handle incoming subtitle text from other peers
  window.socket.on("subtitleText", (data) => {
    if (subtitleManager) {
      subtitleManager.handleRemoteSubtitle(data);
    }
  });

  // Handle hangup event from the other peer
  window.socket.on("peerHangup", () => {
    console.log("📞 Remote peer hung up");
    if (typeof hangup === 'function') {
      hangup();
    }
  });
});

function createOfferEls(offers) {
  //make green answer button for this new offer
  const answerEl = document.querySelector("#answer");
  answerEl.innerHTML = ''; // Clear existing offers
  offers.forEach((o) => {
    console.log(o);
    const newOfferEl = document.createElement("div");
    newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${o.offererUserName}</button>`;
    newOfferEl.addEventListener("click", () => answerOffer(o));
    answerEl.appendChild(newOfferEl);
  });
}
