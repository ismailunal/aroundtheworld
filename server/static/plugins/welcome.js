var Welcome = (function() {
  var container = $('#welcome');
  return {
     update: function() {
       $('.alternative', container).hide();
       if (!STATE.user) {
         $('.not-logged-in', container).show();
       } else if (!STATE.location) {
         $('.not-chosen-location', container).show();
         $.getJSON('/location.json', function(response) {
           var c = $('select[name="id"]', container);
           $.each(response.locations, function(i, each) {
             $('<option>')
               .attr('value', each.id)
                 .text(each.name)
                   .appendTo(c);
           });
           c.on('change', function() {
             $(this).parent('form').submit();
           });
           $('.not-chosen-location form', container).on('submit', function() {
             var id = $('select[name="id"] option:selected', container).attr('value');
             $.post('/location.json', {id:id}, function(response) {
               State.update();
               Loader.load_hash('#city');
             });
             return false;
           });
         });

       } else {
         $('.welcome-back', container).show();
         var c = $('.welcome-back', container);
         $('.current-location', c).html(STATE.location.name);
       }
     }
  };
})();

Plugins.start('welcome', function() {
  // called every time this plugin is loaded
  Welcome.update();
});
