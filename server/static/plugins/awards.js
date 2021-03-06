var Awards = (function() {
  var container = $('#awards');
  var URL = '/awards.json';
  var TWEET_URL = '/awards-tweet.json';
  var loaded = {};
  var thumbnail = $('img.thumbnail-template', container);
  var _once = false;

  function _display_award(award) {
    var c = $('.index-outer', container);
    loaded[award.id] = award;
    var d = $('<div>')
      .addClass('award')
        .addClass('type-' + award.type);
    function make_a(award_id) {
      return $('<a href="#awards,">')
        .attr('href', '#awards,' + award_id)
          .data('id', award_id).click(function() {
            Awards.load_award($(this).data('id'));
            //return false;
          });
    }
    var ta = make_a(award.id);
    thumbnail.clone().show().appendTo(ta);
    ta.appendTo(d);
    d.append(make_a(award.id).text(award.description).addClass('title'));
    if (!award.read) {
      d.append($('<span class="label label-success new-award">New!</span>')
                .data('id', award.id));
    }
    d.append($('<p>').text("Awarded to you on " + award.date));
    c.append(d);
  }

  function _display_modal_award(award) {
    var c = $('.wrapper', container);
    var award_type = award.type.replace(/ /g, '-');
    $.each(['title', 'type', 'description'], function(i, prefix) {
      $('.' + prefix, c).hide();
      if ($('.' + prefix + '-' + award_type, c).size()) {
        $('.' + prefix + '-' + award_type, c).show();
      } else {
        $('.' + prefix + '-generic', c).show();
      }
    });
    if (!$('.description-' + award_type, c).size()) {
      $('.description-other').html(award.description).show();
    }
    $('.category', c).text(award.category);
    $('.location', c).text(award.location);
    $('.name', c).text(award.name);
    $('.date', c).text(award.date);
    $('.signature', c).text(award.ambassador);
    Utils.update_title(award.description);
    if (award.long_description) {
      $('.long-description span', container).html(award.long_description);
      $('.long-description', container).show();
    } else {
      $('.long-description', container).hide();
    }
    if (award.uniqueness) {
      // use Math.ceil so that 0.2314 becomes 1% at least
      $('.uniqueness-percentage', container).text(Math.ceil(award.uniqueness) + '%');
      if (award.uniqueness < 25) {
        $('.uniqueness-great', container).show();
        $('.uniqueness-ok', container).hide();
      } else {
        $('.uniqueness-great', container).hide();
        $('.uniqueness-ok', container).show();
      }
      $('.uniqueness', container).show();
    } else {
      $('.uniqueness', container).hide();
    }
    if (STATE.user && STATE.user.anonymous) {
      $('.login-push', container).show();
    } else {
      $('.login-push', container).hide();
    }

    $('.bragging-rights', container).hide();
    if (STATE.user && STATE.user.name == award.name) {
      // it's your award
      $.getJSON(TWEET_URL, {id: award.id}, function(response) {
        if (response.text) {
          // Nick: ardthewrld
          // https://twitter.com/intent/tweet?original_referer=https%3A%2F%2Fwww.filepicker.io%2Fdemos%2F&source=tweetbutton&text=Filepicker.io%20%7C%20Demos&url=https%3A%2F%2Fwww.filepicker.io&via=filepicker
          var twitter_url = 'http://twitter.com/home?status='+ encodeURI(response.text);
          $('a.twitter', container)
            .attr('href', twitter_url)
              .click(function() {
                window.open(twitter_url);
                return false;
              });
          var title = award.description + ' on Around The World';
          var facebook_url = 'https://www.facebook.com/sharer.php?s=100&p[title]=' + encodeURI(title) + '&p[url]=' + encodeURI(response.url) + '&p[summary]=' + encodeURI(response.text);
          $('a.facebook', container)
            .attr('href', facebook_url)
              .click(function() {
                window.open(facebook_url);
                return false;
              });
          $('.bragging-rights textarea', container).val(response.text);
          $('.bragging-rights', container).fadeIn(500);
        }
      });
    }
  }

  function setup_once() {
    $('a.return', container).click(function() {
      $('.wrapper-outer', container).hide();
      $('.index-outer', container).show();
      Utils.update_title();
      if (location.hash != '#awards') {
        location.hash = '#awards';
      }
      return false;
    });
    $('.bragging-rights textarea', container).on('focus', function() {
      $(this).off('focus').select();
    });
  }

  return {
     load: function() {
       if (!_once) {
         setup_once();
         _once = true;
       }
       Utils.update_title();
       Utils.loading_overlay_reset();

       var _has_preloaded = false;
       $.getJSON(URL, function(response) {
         if (response.error == 'NOTLOGGEDIN') return State.redirect_login();
         $('.index-outer .award', container).remove();
         loaded = {};

         Utils.loading_overlay_remove();
         $.each(response.awards, function(i, award) {
           if (!award.read && !_has_preloaded) {
             sounds.preload('applause');
             _has_preloaded = true;
           }
           _display_award(award);
           $('.index-outer .explanation-' + award.type).addClass('done');
         });
         if (!response.awards.length) {
           if (STATE.user) {
             $('.none', container).show();
           }
         } else {
           $('.none', container).hide();
         }
       });
     },
    load_award: function(id, callback) {
      $.getJSON(URL, {id: id}, function(response) {
        if (response.error == 'NOTLOGGEDIN') return State.redirect_login();
        if (response.error == 'INVALIDAWARD') {
          alert('Error! Invalid award');
          return;
        }
        Utils.loading_overlay_remove();
        if (response.award.was_unread) {
          sounds.play('applause');
        }
        //loaded = {};
        _display_modal_award(response.award);
        $('.wrapper-outer', container).show();
        $('.index-outer', container).hide();
        if (STATE.user) {
          $('a.yours', container).show();
          $('a.not-yours', container).hide();
        } else {
          $('a.yours', container).hide();
          $('a.not-yours', container).show();
        }

        $('.new-award', container).each(function() {
          if ($(this).data('id') == response.award.id) {
            $(this).remove();
          }
        });

        if (typeof Mousetrap !== 'undefined' && STATE.user) {
          // not necessarily loaded in mobile
          Mousetrap.bind('esc', function() {
            $('.return:visible', container).click();
          });
        }
        State.update();
        if (callback) callback();
      });
    },
    teardown: function() {
      if (typeof Mousetrap !== 'undefined') {
        Mousetrap.reset();
      }
    }
  };
})();

Plugins.start('awards', function(id) {
  if (id) {
    Awards.load_award(id);
  } else if (!STATE.user) {
    return State.redirect_login();
  }
  Awards.load();
});


Plugins.stop('awards', function() {
  Awards.teardown();
});
