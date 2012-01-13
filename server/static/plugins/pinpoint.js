var Pinpoint = (function() {
  var container = $('#pinpoint');
  var timer;
  var skip_timer;
  var countdown;
  var click_listener, dblclick_listener;
  var _cities_removed = false;
  var count_questions = 0;
  var initial_center;
  var infowindow, dropped_marker, correct_marker;
  var _next_is_last = false;
  var t0, t1;

  function _show_no_questions(number, total) {
    $('.no-questions', '#pinpoint-tucked').text(number + ' of ' + total);
  }

  function _show_question(question) {
    if (initial_center != map.getCenter()) {
      // reset to the original center
      map.setCenter(initial_center);
    }
    //$('#pinpoint-tucked:visible').hide();
    $('#pinpoint-splash h1, #pinpoint-tucked p.current').text(question.name);
    $('#pinpoint-tucked p.current:hidden').show();
    $('#pinpoint-tucked p.timer:visible').hide();
    $('#pinpoint-tucked p.skip:visible').hide();
    $('#pinpoint-splash:hidden').show();
    //$('#pinpoint:hidden').show();
    var begin_timer = setTimeout(function() {
      _begin(question.seconds);
    }, 2 * 1000);
    $('#pinpoint-splash').unbind('click').click(function() {
      // in a rush, eh?
      clearTimeout(begin_timer);
      _begin(question.seconds);
    });
  }

  function _begin(seconds) {
    countdown = seconds;
    Pinpoint.start();
    $('#pinpoint-tucked p.timer:hidden').show();
    $('#pinpoint-splash').fadeOut(300);
    $('#pinpoint-tucked').show();
    $('#pinpoint-tucked p.skip:visible').hide();
  }

  function _show_summary(summary) {
    var _total_points = 0.0, _total_miles = 0.0, _total_time = 0.0;
    var tbody = $('.finish tbody', container);
    $('tbody tr', container).remove();
    $('tfoot .points-total').text('');
    $.each(summary, function(i, each) {
      var tr = $('<tr>');
      $('<td>')
        .text(each.city)
          .appendTo(tr);
      if (each.timedout) {
        $('<td>')
          .addClass('timedout')
            .text('')
              .appendTo(tr);
        $('<td>')
          .addClass('timedout')
            .text('timed out')
              .appendTo(tr);
      } else {
        $('<td>')
          .addClass('number')
            .text(Utils.formatMiles(each.miles))
              .appendTo(tr);
        $('<td>')
          .addClass('number')
            .text(Utils.formatPoints(each.time))
              .appendTo(tr);
      }
      $('<td>')
        .addClass('number')
          .text(Utils.formatPoints(each.points))
            .appendTo(tr);
      _total_points += each.points;
      tr.appendTo(tbody);
    });

    $('tfoot .points-total', container)
      .text(Utils.formatPoints(_total_points));
  }

  function _finish() {
    Pinpoint.teardown();
    $.getJSON('/pinpoint.json', {finish: true}, function(response) {
      $('#pinpoint-tucked:visible').hide();
      $('#pinpoint-splash:visible').hide();
      container.show();
      $('.begin', container).hide();
      c = $('.finish', container);
      $('.total-points', c).text(Utils.formatPoints(response.results.total_points, true));
      $('.coins', c).text(Utils.formatCost(response.results.coins, true));
      State.show_coin_change(response.results.coins, true);
      _show_summary(response.summary);
      c.show();

      setTimeout(function() {  // is this needed?
        State.update();
      }, 2 * 1000);
    });
  }

  return {
     tick: function () {
       countdown--;
       $('#pinpoint-tucked .timer').text(countdown);
       if (countdown == 0) {
         Pinpoint.stop_timer(true);
       } else {
         timer = setTimeout(function() {
           Pinpoint.tick();
         }, 1000);
       }
     },
     start: function () {
       t0 = new Date();
       Pinpoint.tick();
       //timeout_timer = setTimeout(function() {
       //  L("time out!");
       //}, seconds * 1000);
       click_listener = google.maps.event.addListener(map, 'click', function(event) {
         t1 = new Date();
         Pinpoint.place_marker(event.latLng, (t1 - t0) / 1000);
       });
     },
     place_marker: function (latlng, time_taken) {
       google.maps.event.removeListener(click_listener);
       Pinpoint.stop_timer(false);
       if (!countdown) {
         L('sorry too late!');
         Pinpoint.prepare_next(3);
         return;
       }
       dropped_marker = new google.maps.Marker({
          position: latlng,
         map: map,
         title: "Your guess!",
         draggable: false,
         icon: '/static/images/pinpoint/dropped.png',
         animation: google.maps.Animation.DROP
       });

       var _data = {lat: latlng.lat(), lng:latlng.lng(), time: time_taken};
       $.post('/pinpoint.json', _data, function(response) {
         if (false && response.correct) {
           dropped_marker.setAnimation(google.maps.Animation.BOUNCE);
           setTimeout(function() {
             dropped_marker.setAnimation(null);
           }, 3 * 1000);
         }
         correct_marker = new google.maps.Marker({
            position: new google.maps.LatLng(response.correct_position.lat, response.correct_position.lng),
           map: map,
           title: "Correct place!",
           draggable: false,
           icon: '/static/images/pinpoint/correct.png',
           animation: google.maps.Animation.DROP
         });
         setTimeout(function() {
           var info_message = '<strong>' + response.points + ' points</strong><br>';
           info_message += '<em>' + Utils.formatMiles(response.miles, true) + '</em>';
           info_message += ' in <em>' + response.time + ' seconds</em>';
           infowindow = new google.maps.InfoWindow({
              content: info_message
           });
           infowindow.open(map, dropped_marker);
         }, 1000);

         setTimeout(function() {
           if (_next_is_last) {
             _finish();
           } else {
             Pinpoint.prepare_next(3);
           }
         }, 2 * 1000);

       });
     },
    prepare_next: function(seconds) {
      countdown = seconds;
      var c = $('#pinpoint-tucked');
      $('.skip a', c).text('Next!');
      c.show();
      $('p.skip:hidden', c).show();
      $('.current:visible', c).hide();
      Pinpoint.tick();
    },
    stop_timer: function (timedout) {
       if (timer)
         clearTimeout(timer);
       if (click_listener)
         google.maps.event.removeListener(click_listener);

      if (_next_is_last) {
        //_finish();
      } else {
        if (timedout) {
          Pinpoint.load_next();
        }
      }
     },
     setup: function (callback) {
       if (map == null) {
         throw "Can't run flying plugin without map";
       }

       $.getJSON('/pinpoint.json', function(response) {
         if (response.error == 'NOTLOGGEDIN') return State.redirect_login();

         _show_no_questions(1, response.no_questions);
         var sw = new google.maps.LatLng(response.center.sw.lat,
                                         response.center.sw.lng);
         var ne = new google.maps.LatLng(response.center.ne.lat,
                                         response.center.ne.lng);
         var bounds = new google.maps.LatLngBounds(sw, ne);
         map.fitBounds(bounds);
         /*if (map.getZoom() >
         L("AFTER", map.getZoom());*/

         /*
         new google.maps.Rectangle({
            bounds: new google.maps.LatLngBounds(sw, ne),
           strokeColor: '#ff0000',
           strokeWeight: 1,
           fillColor: '#ff3300',
           fillOpacity: 0.5
         }).setMap(map);
          */

         $('.begin form', container).off('submit').submit(function() {
           container.hide();
           $('#pinpoint-tucked .skip:hidden').show();
           $('#pinpoint-tucked .skip a').click(function() {
             Pinpoint.stop_timer(true);
             return false;
           });
           $('#pinpoint-tucked').show();
           $('#pinpoint-tucked .skip:hidden').show();
           $('#pinpoint-tucked .current:visible').hide();
           countdown = 10 + 1;
           Pinpoint.tick();
           return false;
         });

         Utils.preload_image('/static/images/pinpoint/dropped.png');
         Utils.preload_image('/static/images/pinpoint/correct.png');

         callback();
       });

     },
    load_next: function() {
      if (!_cities_removed) {
         var styles = [{
            featureType: "administrative.locality",
           stylers: [{
              visibility: "off"
           }]
         }];
        map.setOptions({styles: styles, disableDoubleClickZoom: true});
        _cities_removed = true;
      }

      if (dropped_marker || correct_marker || infowindow) {
        dropped_marker.setVisible(false);
        correct_marker.setVisible(false);
        infowindow.close();
      }

      if (!initial_center) {
        initial_center = map.getCenter();
      } else {
      }
      $.getJSON('/pinpoint.json', {next: true}, function(response) {
        _show_no_questions(response.no_questions.number, response.no_questions.total);
        if (response.no_questions.last) {
          _next_is_last = true;
        }
        if (response.question) {
          _show_question(response.question);
        }
      });
    },
    teardown: function() {
      L('Tearing down');
      if (skip_timer) clearTimeout(skip_timer);
      if (timer) clearTimeout(timer);
      $('#pinpoint-splash').hide();
      $('#pinpoint-tucked').hide();
      if (dropped_marker || correct_marker || infowindow) {
        dropped_marker.setVisible(false);
        correct_marker.setVisible(false);
        infowindow.close();
      }
      var styles = [{
         featureType: "administrative.locality",
         stylers: [{
           visibility: "on"
        }]
      }];
      map.setOptions({styles: styles, disableDoubleClickZoom: false});

    }
  };
})();

Plugins.start('pinpoint', function() {
  Pinpoint.setup(function() {
    //Pinpoint.load_next();
  });
});


// XXX: this is not implemented yet
Plugins.stop('pinpoint', function() {
  Pinpoint.teardown();
});