function L() {
  if (window.console && window.console.log)
    console.log.apply(console, arguments);
}

$(function() {
  $("abbr.timeago").timeago();

  $('.dropdown-toggle').dropdown();

  $('.alert a.close').click(function() {
    $(this).parent('div.alert').fadeOut(400);
    return false;
  });

  if ($('div.alert').size()) {
    setTimeout(function() {
      $('div.alert:visible').each(function() {
        $(this).fadeOut(1000);
      });
    }, 10 * 1000);
  }

  $('a.thumbnail-preview').click(function() {
    $('h3', '#picture-modal').text($(this).data('title'));
    $('img', '#picture-modal').attr('src', $(this).attr('href'));
    $('#picture-modal').modal('show');
    return false;
  });
  $('.modal a.close, .modal a.btn').click(function() {
    $('#picture-modal').modal('hide');
    return false;
  });

  $('a[rel="tooltip"]').tooltip();

  $('button[type="reset"]').click(function() {
    window.location = '..';
  });

  $('.error input', 'form').change(function() {
    $(this).parents('.error').removeClass('error');
  });

  var title = null;
  if ($('h1:visible').size()) {
    if ($('h1:visible').size() == 1) {
      title = $('h1:visible').text();
    }
  } else if ($('h2:visible').size()) {
    if ($('h2:visible').size() == 1) {
      title = $('h2:visible').text();
    }
  }
  if (title) {
    document.title = "Admin: " + title;
  }

  if ($('.next a').size()) {
    Mousetrap.bind('right', function() {
      // xxx why doesn't $('.next a').click() work?!
      window.location.href = $('.next a').attr('href');
    });
  }

  if ($('.prev a').size()) {
    Mousetrap.bind('left', function() {
      window.location.href = $('.prev a').attr('href');
    });
  }

});
