// map of instancename -> FCKeditor object
var fckInstances = {};
var fckActiveId = false;
// this object will store teaser information
var fckTeaser = { lookup : {}, lookupSetup : false, cache : {} };

/**
 * Drupal behavior that adds FCKeditors to textareas
 */
Drupal.behaviors.fckeditor = function(context) {
  // make sure the textarea behavior is run first, to get a correctly sized grippie
  // the textarea behavior requires the teaser behavior, so load that one as well
  if (Drupal.behaviors.teaser && Drupal.behaviors.textarea) {
    Drupal.behaviors.teaser(context);
    Drupal.behaviors.textarea(context);
  }
  
  $('textarea.fckeditor:not(.fckeditor-processed)', context).each(function() {
    var textarea = $(this).addClass('fckeditor-processed');

    var taid = textarea.attr('id');
    if (fckInstances[taid]) {
      var editorInstance = fckInstances[taid];

      if (editorInstance.defaultState == 1) {
        if (textarea.attr('class').indexOf("filterxss1") != -1 || textarea.attr('class').indexOf("filterxss2") != -1) {
          $.post(Drupal.settings.basePath + 'index.php?q=fckeditor/xss', {
            'text': $('#' + taid).val(),
            'token': Drupal.settings.fckeditor.ajaxToken
            },
            function(text) {
              textarea.val(text);
              $('#img_assist-link-' + taid).hide();
              $(".img_assist-button").hide();
              editorInstance.ReplaceTextarea();
            }
          );
        }
        else {
          editorInstance.ReplaceTextarea();
          $('#img_assist-link-' + taid).hide();
          $(".img_assist-button").hide();
        }
      }
    }
  });
}

/**
 * This method takes care of replacing a textarea with an FCKeditor
 * and vice versa.
 */
function Toggle(textareaID, TextTextarea, TextRTE, xss_check)
{
  var swtch = $('#switch_'+textareaID);

  // check if this FCKeditor was initially disabled
  if (fckInstances[textareaID].defaultState == 0) {
    fckInstances[textareaID].defaultState = 2;
    if ($('#' + textareaID).attr('class').indexOf("filterxss2") != -1) {
      $.post(Drupal.settings.basePath + 'index.php?q=fckeditor/xss', {
        'text': $('#' + textareaID).val(),
        'token': Drupal.settings.fckeditor.ajaxToken
        },
        function(text) {
          $('#' + textareaID).val(text);
          fckInstances[textareaID].ReplaceTextarea();
        }
      );
    }
    else {
      fckInstances[textareaID].ReplaceTextarea();
    }
    swtch.text(TextTextarea);
    $(".img_assist-button").hide();
    // simply return: ReplaceTextarea will take the contents of the textarea for us
    return;
  }

  var textArea = $('#'+textareaID);
  var textAreaContainer = textArea.parents('.resizable-textarea');
  var editorFrame = $('#'+textareaID+'___Frame');
  var editorInstance = FCKeditorAPI.GetInstance(textareaID);
  var text;

  // execute the switch
  if (textArea.is(':hidden')) {
    // switch from fck to textarea
    swtch.text(TextRTE);

    text = editorInstance.GetData(true);
    // #372150 and #374386
    if (text == '<br />' || text == '<p>&#160;</p>' || text == '<div>&#160;</div>') {
        text = '';
    }

    // check if we have to take care of teasers
    var teaser = FCKeditor_TeaserInfo(textareaID);
    if (teaser) {
      var t = text.indexOf('<!--break-->');
      if (t != -1) {
        teaser.textarea.val(FCKeditor_trim(text.slice(0,t)));
        text = FCKeditor_trim(text.slice(t+12));

        teaser.textareaContainer.show();
        teaser.textarea.attr('disabled', '');
        if (teaser.button.attr('value') != Drupal.t('Join summary')) {
          try {teaser.button.click();} catch(e) {teaser.button.val(Drupal.t('Join summary'));}
        }
      } else {
        teaser.textarea.attr('disabled', 'disabled');
        if (teaser.button.attr('value') != Drupal.t('Split summary at cursor')) {
          try {teaser.button.click();} catch(e) {teaser.button.val(Drupal.t('Split summary at cursor'));}
        }
      }

      teaser.buttonContainer.show();
    }
    textArea.val(text);

    textArea.show();
    textAreaContainer.show();
    editorFrame.hide();
    $('#img_assist-link-' + textareaID).show();
    $(".img_assist-button").show();
    $(textArea).parent().children(".grippie").show();
  } else {
    // switch from textarea to fck
    swtch.text(TextTextarea);

    // check if we have to take care of teasers
    var teaser = FCKeditor_TeaserInfo(textareaID);

    if (teaser) {
      if (teaser.textarea.val().length > 0) {
        text = teaser.textarea.val() + '\n<!--break-->\n' + textArea.val();
      } else {
        text = textArea.val();
      }
      teaser.textarea.attr('disabled', '');
      teaser.buttonContainer.hide();
      teaser.textareaContainer.hide();
      teaser.checkboxContainer.show();
    } else {
      text = textArea.val();
    }

    editorInstance.SetData(text, true);

    // Switch the DIVs display.
    textArea.hide();
    textAreaContainer.show();
    textArea.parent().children('.grippie').hide();
    editorFrame.show();
    $('#img_assist-link-' + textareaID).hide();
    $(".img_assist-button").hide();
  }
}

// Update a global variable containing the active FCKeditor ID.
function DoFCKeditorUpdateId(editorInstance) {
  fckActiveId = editorInstance.Name;
}

/**
 * The FCKeditor_OnComplete function is a special function called everytime an
 * editor instance is completely loaded and available for API interactions.
 */
function FCKeditor_OnComplete(editorInstance) {
  // Enable the switch button. It is disabled at startup, waiting the editor to be loaded.
  $('#switch_' + editorInstance.Name).show();
  editorInstance.Events.AttachEvent('OnAfterLinkedFieldUpdate', FCKeditor_OnAfterLinkedFieldUpdate);
  editorInstance.Events.AttachEvent('OnFocus', DoFCKeditorUpdateId);

  var teaser = FCKeditor_TeaserInfo(editorInstance.Name);

  if (teaser) {
    // if there is a teaser, prepend it to the text, only when switched to FCKeditor using toggle
    //if (fckInstances[editorInstance.Name].defaultState == 2) {
      if (teaser.textarea.val().length > 0 && editorInstance.GetData(true).indexOf('<!--break-->') == -1 ) {
        var text = teaser.textarea.val() + '\n<!--break-->\n' + editorInstance.GetData(true);
        editorInstance.SetData(text);
      }
    //}
    // hide the teaser
    teaser.textarea.attr('disabled', '');
    teaser.buttonContainer.hide();
    teaser.textareaContainer.hide();
    teaser.checkboxContainer.show();
  }

  // jQuery's hide() does not work when the field is not visible, for instance because it is in a collapsed field set
  $(editorInstance.LinkedField).parent().children('.grippie').each(function() {
    this.style.display = 'none';
  });

  // very ugly hack to circumvent FCKeditor from re-updating textareas on submission. We do that ourselves
  // FCKeditor will happily update the fake textarea while we will use the proper one
  editorInstance.LinkedField2 = editorInstance.LinkedField;
  editorInstance.LinkedField = $('<textarea></textarea>');
  // The save button in the FCKeditor toolbar needs the form property
  editorInstance.LinkedField.form = editorInstance.LinkedField2.form;

  // Img_Assist integration
  IntegrateWithImgAssist();
}

/**
 * This method is executed for every FCKeditor instance just after the underlying text field is updated
 * before the form is submitted.
 */
function FCKeditor_OnAfterLinkedFieldUpdate(editorInstance) {
  var textArea = editorInstance.LinkedField2;
  var taid = textArea.id;

  var teaser = FCKeditor_TeaserInfo(taid);

  // when textArea is hidden, FCKeditor is visible
  if ($(textArea).is(':hidden')) {
    var text = editorInstance.GetData(true);
    // #372150 and #374386
    if (text == '<br />' || text == '<p>&#160;</p>' || text == '<div>&#160;</div>') {
        text = '';
    }
    textArea.value = text;
    // only update the teaser field if this field is associated with a teaser field
    if (teaser) {
      var t = text.indexOf('<!--break-->');
      if (t != -1) {
        teaser.textarea.val(FCKeditor_trim(text.slice(0,t)));
        textArea.value = FCKeditor_trim(text.slice(t+12));
      } else {
        teaser.textarea.val('');
        teaser.textarea.attr('disabled', 'disabled');

        var teaserbuttontxt = Drupal.t('Join summary');

        if (teaser.button.attr('value') == teaserbuttontxt) {
          try {
            teaser.button.click();
          } catch(e) {
            teaserbutton.val(teaserbuttontxt);
          }
        }
      }
    }
  }
}

function IntegrateWithImgAssist()
{
  var link = document.getElementsByTagName("a");
  for (var i = 0; i < link.length; i++) {
    cl = link[i].className;
    if ( cl == "img_assist-link") {
      link[i].href = link[i].href.replace("/load/textarea", "/load/fckeditor");
    }
  }
}

/**
 * Removes leading and trailing whitespace from the input
 */
function FCKeditor_trim(text) {
  return text.replace(/^\s+/g, '').replace(/\s+$/g, '');
}

/**
 * This function retrieves information about a possible teaser field
 * associated with the mentioned field.
 *
 * @param taid string HTML id of the main text area
 */
function FCKeditor_TeaserInfo(taid) {
  // if the result is cached, return it
  if (fckTeaser.cache[taid]) {
    return fckTeaser.cache[taid];
  }

  // build a lookup table
  if (!fckTeaser.lookupSetup) {
    fckTeaser.lookupSetup = true;
    for(var x in Drupal.settings.teaser) {
      fckTeaser.lookup[Drupal.settings.teaser[x]] = x;
    }
  }

  // find the elements
  if (fckTeaser.lookup[taid]) {
    var obj = {
      textarea : $('#'+fckTeaser.lookup[taid]),
      checkbox : $('#'+Drupal.settings.teaserCheckbox[fckTeaser.lookup[taid]])
    };

    obj.textareaContainer = obj.textarea.parent();
    obj.checkboxContainer = obj.checkbox.parent();

    obj.button = $('input.teaser-button', obj.checkbox.parents('div.teaser-checkbox').get(0));
    obj.buttonContainer = obj.button.parent();

    fckTeaser.cache[taid] = obj;
  } else {
    fckTeaser.cache[taid] = null;
  }

  return fckTeaser.cache[taid];
}

/**
 * Creates a screen wide popup window containing an FCKeditor
 */
function FCKeditor_OpenPopup(popupUrl, jsID, textareaID, width) {
  popupUrl = popupUrl + '?var='+ jsID + '&el=' + textareaID;

  var teaser = FCKeditor_TeaserInfo(textareaID);
  if (teaser) {
    popupUrl = popupUrl + '&teaser=' + teaser.textarea.attr('id');
  }

  var percentPos = width.indexOf('%');
  if (percentPos != -1) {
    width = width.substr(0, percentPos);
    width = width / 100 * screen.width;
  }

  window.open(popupUrl, null, 'width=' + width + ',toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=1,dependent=yes');
}

// Probably JsMin was used to compress the code.
// In such case, in IE FCKeditor_IsCompatibleBrowser() will always return false.
if (typeof(FCKeditor_IsCompatibleBrowser) == 'function' && !FCKeditor_IsCompatibleBrowser()) {
  var FCKeditor_IsCompatibleBrowser = function() {
    var sAgent = navigator.userAgent.toLowerCase() ;
    // Internet Explorer 5.5+
    if ( sAgent.indexOf("mac") == -1 && sAgent.indexOf("opera") == -1 && navigator.appVersion.match( /MSIE (.\..)/ ) )
    {
      var sBrowserVersion = navigator.appVersion.match(/MSIE (.\..)/)[1] ;
      return ( sBrowserVersion >= 5.5 ) ;
    }
    return false;
  }
}

/**
 * Integration for ajax.module
 */
function doFCKeditorSave() {
  for(var textareaid in fckInstances) {
    FCKeditor_OnAfterLinkedFieldUpdate(FCKeditorAPI.GetInstance(textareaid));
  }
}