import datetime
import re
import urllib
from collections import defaultdict
from pymongo.objectid import ObjectId
import tornado.escape
from tornado_utils.routes import route
from .forms import QuestionForm
from .base import AuthenticatedBaseHandler
from .base import djangolike_request_dict


@route('/admin/questions/numbers/', name='admin_questions_numbers')
class QuestionsNumbersHandler(AuthenticatedBaseHandler):

    def get(self):
        data = {}
        categories = ['Jan', 'Feb']
        data['categories_json'] = tornado.escape.json_encode(categories)
        series = defaultdict(list)
        dates = (datetime.datetime(2012, 1, 1),
                 datetime.datetime(2012, 2, 1),
                 datetime.datetime(2012, 3, 1))
        intervals = []
        _prev = None
        for each in dates:
            if _prev is not None:
                intervals.append((_prev, each))
            _prev = each

        for start, end in intervals:
            _counts = defaultdict(int)
            for question in (self.db.Question
                             .find({'published': True,
                                    'add_date': {'$gte': start, '$lt': end}})):
                _counts[question['location']] += 1
            for location, count in _counts.items():
                series[location].append(count)

        _names = dict((x['_id'], x['country'])
                      for x in self.db.Location.find())
        series = [{'name': _names[x], 'data': y}
                  for x, y in series.items()]
        data['series_json'] = tornado.escape.json_encode(series)
        self.render('admin/questions_numbers.html', **data)


@route('/admin/questions/', name='admin_questions')
class QuestionsAdminHandler(AuthenticatedBaseHandler):
    LIMIT = 20

    def get(self):
        data = {}
        filter_ = {}
        data['q'] = self.get_argument('q', '')
        if data['q']:
            _q = [re.escape(x.strip()) for x in data['q'].split(',')
                  if x.strip()]
            filter_['text'] = re.compile('|'.join(_q), re.I)
        data['all_locations'] = (
          self.db.Location
          .find({'airport_name': {'$ne': None}})
          .sort('code')
        )
        data['all_categories'] = (
          self.db.Category
          .find({'name': {'$nin': ['Geographer']}})
          .sort('name')
        )
        data['points_values'] = self.get_arguments('points_values', [])
        if data['points_values']:
            data['points_values'] = [int(x) for x in data['points_values']]
            filter_['points_value'] = {'$in': data['points_values']}
        data['locations'] = self.get_arguments('locations', [])
        if data['locations']:
            filter_['location'] = {
              '$in': [x['_id'] for x in
                       self.db.Location
                        .find({'code': {'$in': data['locations']}})]
            }

        data['categories'] = self.get_arguments('categories', [])
        if data['categories']:
            filter_['category'] = {
              '$in': [x['_id'] for x in
                       self.db.Category
                        .find({'name': {'$in': data['categories']}})]
            }
        data['authors'] = self.get_arguments('authors', [])
        if data['authors']:
            filter_['author'] = {
              '$in': [ObjectId(x) for x in data['authors']]
            }

        args = dict(self.request.arguments)
        if 'page' in args:
            args.pop('page')
        data['query_string'] = urllib.urlencode(args, True)

        data['page'] = int(self.get_argument('page', 1))
        skip = (data['page'] - 1) * self.LIMIT
        questions = []
        _locations = {}
        _categories = {}
        _users = {}
        data['count'] = self.db.Question.find(filter_).count()
        data['all_pages'] = range(1, data['count'] / self.LIMIT + 2)
        data['filtering'] = bool(filter_)
        for each in (self.db.Question
                     .find(filter_)
                     .sort('add_date', -1)  # newest first
                     .limit(self.LIMIT)
                     .skip(skip)):
            if each['category'] not in _categories:
                _categories[each['category']] = \
                  self.db.Category.find_one({'_id': each['category']})
            if each['location'] not in _locations:
                _locations[each['location']] = \
                  self.db.Location.find_one({'_id': each['location']})
            if each['author'] and each['author'] not in _users:
                _users[each['author']] = \
                  self.db.User.find_one({'_id': each['author']})
            questions.append((
              each,
              _categories[each['category']],
              _locations[each['location']],
              each['author'] and _users[each['author']] or None,
            ))
        data['questions'] = questions
        data['all_authors'] = _users.values()

        self.render('admin/questions.html', **data)


class BaseQuestionAdminHandler(AuthenticatedBaseHandler):

    @property
    def categories(self):
        return self.db.Category.find({'name': {'$nin': ['Geographer']}})

    @property
    def locations(self):
        user = self.get_current_user()
        filter_ = {'airport_name': {'$ne': None}}
        if not user['superuser']:
            countries = (self.db.Ambassador
                         .find({'user': user['_id']})
                         .distinct('country'))
            assert countries  # no support for mayors yet
            filter_['country'] = {'$in': countries}
        return (self.db.Location
                .find(filter_)
                .sort('code', 1))


@route('/admin/questions/add/', name='admin_add_question')
class AddQuestionAdminHandler(BaseQuestionAdminHandler):

    def get(self, form=None):
        data = {}
        if form is None:
            form = QuestionForm(categories=self.categories,
                                locations=self.locations)
        data['form'] = form
        self.render('admin/add_question.html', **data)

    def post(self):
        post_data = djangolike_request_dict(self.request.arguments)
        if 'alternatives' in post_data:
            post_data['alternatives'] = ['\n'.join(post_data['alternatives'])]
        form = QuestionForm(post_data,
                            categories=self.categories,
                            locations=self.locations)
        if form.validate():
            question = self.db.Question()
            question['author'] = self.get_current_user()['_id']
            question['text'] = form.text.data
            question['correct'] = form.correct.data
            question['alternatives'] = [x.strip() for x
                                        in form.alternatives.data.split()
                                        if x.strip()]
            question['alternatives_sorted'] = form.alternatives_sorted.data
            category = (self.db.Category
                        .find_one({'_id': ObjectId(form.category.data)}))
            assert category
            question['category'] = category['_id']
            question['points_value'] = int(form.points_value.data)
            question['published'] = form.published.data
            print repr(form.published.data)
            question['notes'] = form.notes.data.strip()
            location = (self.db.Location
                        .find_one({'_id': ObjectId(form.location.data)}))
            assert location
            question['location'] = location['_id']
            question.save()

            self.redirect(self.reverse_url('admin_questions'))
        else:
            self.get(form=form)


@route('/admin/questions/(\w{24})/', name='admin_question')
class QuestionAdminHandler(BaseQuestionAdminHandler):

    def get(self, _id, form=None):
        data = {}
        data['question'] = self.db.Question.find_one({'_id': ObjectId(_id)})
        if form is None:
            initial = dict(data['question'])
            #initial['spell_correct'] = question.spell_correct
            #initial['genre'] = question.genre.name
            form = QuestionForm(categories=self.categories,
                                locations=self.locations,
                                **initial)
        data['form'] = form
        self.render('admin/question.html', **data)

    def post(self, _id):
        data = {}
        question = self.db.Question.find_one({'_id': ObjectId(_id)})
        data['question'] = question
        post_data = djangolike_request_dict(self.request.arguments)
        if 'alternatives' in post_data:
            post_data['alternatives'] = ['\n'.join(post_data['alternatives'])]

        form = QuestionForm(post_data,
                            categories=self.categories,
                            locations=self.locations)
        if form.validate():
            question['text'] = form.text.data
            question['correct'] = form.correct.data
            question['alternatives'] = [x.strip() for x
                                        in form.alternatives.data.split()
                                        if x.strip()]
            question['alternatives_sorted'] = form.alternatives_sorted.data
            category = (self.db.Category
                        .find_one({'_id': ObjectId(form.category.data)}))
            assert category
            question['category'] = category['_id']
            question['points_value'] = int(form.points_value.data)
            question['published'] = form.published.data
            question['notes'] = form.notes.data.strip()
            location = (self.db.Location
                        .find_one({'_id': ObjectId(form.location.data)}))
            assert location
            question['location'] = location['_id']
            #print form.category.data
            question.save()
            #raise NotImplementedError
            self.redirect(self.reverse_url('admin_questions'))
        else:
            self.get(_id, form=form)