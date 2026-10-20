/* Subject definitions — single source of truth for subjects */
(function () {
  window.App = window.App || {};
  App.subjects = [
    { id: 'data-engineering', prefix: 'de', name: 'Data Engineering' },
    { id: 'marketing-innovation', prefix: 'mi', name: 'Marketing Innovation' },
    { id: 'feature-engineering', prefix: 'fe', name: 'Feature Engineering' },
    {
      id: 'ai-digital-essentials',
      prefix: 'ai',
      name: 'Artificial Intelligence and Digital Essentials'
    }
  ];
  App.subjectById = function (id) {
    return App.subjects.find(function (s) { return s.id === id; }) || null;
  };
  App.subjectName = function (id) {
    var s = App.subjectById(id);
    return s ? s.name : id;
  };
  App.subjectPrefix = function (id) {
    var s = App.subjectById(id);
    return s ? s.prefix : 'q';
  };
})();