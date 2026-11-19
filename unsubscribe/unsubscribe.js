(function () {
  var PROD_REF = "dlzufbixuxbknhgicevn";
  var DEV_REF = "flkozmvwkxxphuuyyuxl";
  var params = new URLSearchParams(location.search);
  var isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var ref = isLocal && params.get("env") === "dev" ? DEV_REF : PROD_REF;
  var endpoint = "https://" + ref + ".supabase.co/functions/v1/unsubscribe";
  var override = params.get("fn");
  if (isLocal && override) endpoint = override;

  var id = params.get("id") || "";
  var t = params.get("t") || "";
  var btn = document.getElementById("un-btn");
  var msg = document.getElementById("un-msg");

  if (!id || !t) {
    btn.hidden = true;
    msg.textContent = "This link is incomplete. Use the unsubscribe link in the email, or write to contact@exomudra.com.";
    msg.className = "dl-msg err";
    return;
  }

  btn.addEventListener("click", function () {
    btn.disabled = true;
    msg.className = "dl-msg";
    msg.textContent = "";
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, t: t }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("status " + res.status);
        btn.hidden = true;
        msg.textContent = "You're unsubscribed.";
      })
      .catch(function () {
        btn.disabled = false;
        msg.className = "dl-msg err";
        msg.textContent = "Something went wrong. Please try again, or email contact@exomudra.com.";
      });
  });
})();
